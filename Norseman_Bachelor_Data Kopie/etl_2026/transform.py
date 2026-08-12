"""
Transform-Schritt: Rohdaten von RACE RESULT -> historisches Wide-Schema.

Enthaelt die drei Dinge, die bisher manuell waren:

1. Spalten-Erkennung   : ordnet die Spalten der Ergebnisliste automatisch den
                         historischen Split-Namen zu (frueher: IDs im Browser suchen)
2. Aid-Station-Angleich: bringt die Stationen auf exakt die Spalten der Vorjahre
3. Interpolation       : fuellt fehlende Zwischenzeiten feldbasiert auf

Jede interpolierte Zelle wird protokolliert.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import config as C

# ---------------------------------------------------------------------------
# Hilfsfunktionen: Zeitformate
# ---------------------------------------------------------------------------

_NULL_TOKENS = {"", "-", "--", "–", "—", "dnf", "dns", "dq", "n/a", "na", "nan", "none"}

_TIME_RE = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d+))?$")


def parse_time_to_seconds(value: Any) -> float:
    """'5:23:11' / '23:11' / '5:23:11.4' -> Sekunden. Alles andere -> NaN."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return np.nan
    s = str(value).strip()
    if s.lower() in _NULL_TOKENS:
        return np.nan
    s = s.lstrip("+")
    m = _TIME_RE.match(s)
    if not m:
        return np.nan
    hours, minutes, seconds, frac = m.groups()
    total = int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)
    if frac:
        total += float(f"0.{frac}")
    return float(total)


def seconds_to_hms(seconds: Any) -> str | float:
    """Sekunden -> 'HH:MM:SS' (Format der bestehenden Master-Dateien)."""
    if seconds is None or pd.isna(seconds):
        return np.nan
    total = int(round(float(seconds)))
    if total < 0:
        return np.nan
    return f"{total // 3600:02d}:{(total % 3600) // 60:02d}:{total % 60:02d}"


def _norm(text: Any) -> str:
    """Label normalisieren: Akzente weg, klein, nur alphanumerisch."""
    s = unicodedata.normalize("NFKD", str(text))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", s.lower())


# ---------------------------------------------------------------------------
# Rohdaten einlesen
# ---------------------------------------------------------------------------

def load_raw(raw_dir: Path) -> tuple[dict, dict]:
    cfg = json.loads((raw_dir / "config.json").read_text(encoding="utf-8"))
    lists = json.loads((raw_dir / "lists.json").read_text(encoding="utf-8"))
    return cfg, lists


def _iter_rows(data: Any):
    """RACE RESULT liefert data entweder als Liste von Zeilen oder als Dict
    (gruppiert nach Kategorie). Beides flach ausgeben."""
    if data is None:
        return
    if isinstance(data, dict):
        for value in data.values():
            yield from _iter_rows(value)
        return
    if isinstance(data, list):
        if data and all(isinstance(x, list) for x in data):
            yield from data
        elif data and all(not isinstance(x, (list, dict)) for x in data):
            yield data


def list_to_frame(list_json: dict) -> pd.DataFrame:
    """Eine RACE-RESULT-Liste in ein DataFrame mit den Original-Labels umwandeln."""
    meta = list_json.get("list") or {}
    fields = meta.get("Fields") or []
    labels = [f.get("Label") or f.get("Expression") or f"col_{i}" for i, f in enumerate(fields)]

    rows = list(_iter_rows(list_json.get("data")))
    if not rows:
        return pd.DataFrame()

    width = max(len(r) for r in rows)
    # RACE RESULT stellt der Zeile meist die Datensatz-ID voran.
    if width == len(labels) + 1:
        columns = ["_record_id", *labels]
    elif width == len(labels):
        columns = list(labels)
    else:
        columns = [*labels, *[f"extra_{i}" for i in range(width - len(labels))]][:width]

    normalised = [list(r) + [None] * (width - len(r)) for r in rows]
    return pd.DataFrame(normalised, columns=columns)


def pick_best_list(lists_blob: dict, cfg: dict) -> tuple[str, pd.DataFrame]:
    """Waehlt die Liste mit den meisten erkennbaren Split-Spalten."""
    split_tokens = _split_lookup(cfg)
    best_name, best_df, best_score = None, None, -1

    for name, payload in (lists_blob.get("lists") or {}).items():
        try:
            df = list_to_frame(payload)
        except Exception:
            continue
        if df.empty:
            continue
        score = sum(1 for col in df.columns if _norm(col) in split_tokens)
        # Zeilenzahl als Tiebreaker, damit die Gesamtliste vor Top-5-Listen gewinnt
        score = score * 1000 + min(len(df), 999)
        if score > best_score:
            best_name, best_df, best_score = name, df, score

    if best_df is None:
        raise RuntimeError("Keine auswertbare Ergebnisliste in den Rohdaten gefunden.")
    return best_name, best_df


# ---------------------------------------------------------------------------
# Spalten-Zuordnung
# ---------------------------------------------------------------------------

def _split_lookup(cfg: dict) -> dict[str, str]:
    """normalisiertes Label/Name -> historischer Stationsname."""
    lookup: dict[str, str] = {}
    for split in cfg.get("splits", []):
        target = C.SPLIT_NAME_MAP.get(str(split.get("Name", "")).upper(), "__unset__")
        if target == "__unset__":
            target = _guess_station(split)
        if not target:
            continue
        for raw in (split.get("Name"), split.get("Label")):
            if raw:
                lookup[_norm(raw)] = target
    # historische Namen selbst ebenfalls zulassen
    for station in C.STATION_ORDER:
        lookup.setdefault(_norm(station), station)
    return lookup


_KM_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*km")


def _guess_station(split: dict) -> str | None:
    """Fallback, falls die Zeitnahme eine Station umbenennt: ueber Leg + Kilometer
    die naechstgelegene historische Station suchen."""
    label = str(split.get("Label", ""))
    low = label.lower()
    if low.startswith("bike"):
        prefix = "bike"
    elif low.startswith("run"):
        prefix = "run"
    elif "finish" in low and "black" in low:
        return "finish_black_t_shirt"
    else:
        return None

    m = _KM_RE.search(low)
    if not m:
        return None
    km = float(m.group(1).replace(",", "."))

    best, best_delta = None, 1e9
    for station in C.STATION_ORDER:
        if not station.startswith(prefix):
            continue
        cum = C.STATION_CUM_KM.get(station)
        if cum is None:
            continue
        leg_km = cum - (C.SWIM_KM if prefix == "bike" else C.PRE_RUN_KM)
        delta = abs(leg_km - km)
        if delta < best_delta:
            best, best_delta = station, delta
    # nur akzeptieren, wenn es wirklich dieselbe Station sein kann
    return best if best_delta <= 1.5 else None


IDENTITY_PATTERNS: dict[str, list[str]] = {
    "bib": ["bib", "startnr", "startno", "startnumber", "nr", "no", "number"],
    "name": ["name", "navn", "fullname", "participant"],
    "gender": ["gender", "sex", "kjonn", "mf"],
    "country": ["country", "nation", "nat", "land"],
    "club": ["club", "klubb", "team"],
    "contest": ["contest", "wettbewerb"],
    "finish_type": ["shirt", "tshirt", "finishtype", "category", "class"],
    "overall_time": ["totaltime", "finishtime", "time", "total", "result", "tid"],
    "overall_rank": ["place", "rank", "pos", "position", "plass"],
    "status": ["status", "comment", "remark"],
}


def map_columns(df: pd.DataFrame, cfg: dict) -> tuple[dict[str, str], dict[str, str], list[str]]:
    """Ordnet Rohspalten zu.

    Rueckgabe: (identity_map, station_map, unmapped)
      identity_map : logischer Name -> Rohspalte
      station_map  : historische Station -> Rohspalte
      unmapped     : Rohspalten ohne Zuordnung (landen im Mapping-Report)
    """
    split_lookup = _split_lookup(cfg)
    identity: dict[str, str] = {}
    stations: dict[str, str] = {}
    used: set[str] = set()

    # 1) Stationen zuerst - sie sind eindeutig
    for col in df.columns:
        target = split_lookup.get(_norm(col))
        if target and target not in stations:
            stations[target] = col
            used.add(col)

    # 2) Leg-Summen (Swim/T1/Bike/T2/Run) und Identitaet
    # Die Zeitnahme beschriftet die Leg-Summen nicht immer knapp: 2026 heissen
    # sie "Swim to T1" und "Run (Black)". Erst exakt, dann als Praefix suchen.
    leg_targets = {"swim": "swim_time", "t1": "t1_time", "bike": "bike_time",
                   "t2": "t2_time", "run": "run_time"}
    for exact in (True, False):
        for col in df.columns:
            if col in used or str(col).startswith("_"):
                continue
            n = _norm(col)
            for token, target in leg_targets.items():
                if target in identity:
                    continue
                hit = (n == token) if exact else (n.startswith(token) and len(n) <= len(token) + 8)
                if hit:
                    identity[target] = col
                    used.add(col)
                    break

    for logical, patterns in IDENTITY_PATTERNS.items():
        if logical in identity:
            continue
        for col in df.columns:
            if col in used or str(col).startswith("_"):
                continue
            n = _norm(col)
            if any(n == p for p in patterns):
                identity[logical] = col
                used.add(col)
                break
        else:
            for col in df.columns:
                if col in used or str(col).startswith("_"):
                    continue
                n = _norm(col)
                if any(p in n for p in patterns):
                    identity[logical] = col
                    used.add(col)
                    break

    unmapped = [c for c in df.columns if c not in used and not str(c).startswith("_")]
    return identity, stations, unmapped


def filter_main_contest(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Nur das Hauptrennen behalten und Nichtstarter entfernen.

    2026 gibt es neben "Norseman Xtreme Triathlon" einen zweiten Contest
    ("VGTV Norseman"). Die Vorjahre kennen das nicht - wuerde man ihn
    mitnehmen, waeren Athleten doppelt gezaehlt und alle Raenge verschoben.
    """
    dropped: dict[str, int] = {}
    out = df

    contest_col = next((c for c in out.columns if _norm(c) == "contest"), None)
    if contest_col is not None:
        contest = pd.to_numeric(out[contest_col], errors="coerce")
        mask = contest.isna() | (contest == 1)
        removed = int((~mask).sum())
        if removed:
            dropped["Nebenwettbewerb (nicht das Hauptrennen)"] = removed
        out = out[mask]

    # Zeilen ohne jede Zwischenzeit sind Nichtstarter
    time_like = [
        c for c in out.columns
        if not str(c).startswith("_") and out[c].astype("string").str.contains(
            r"^\d{1,2}:\d{2}", na=False, regex=True
        ).any()
    ]
    if time_like:
        has_any = out[time_like].astype("string").apply(
            lambda col: col.str.contains(r"^\d{1,2}:\d{2}", na=False, regex=True)
        ).any(axis=1)
        removed = int((~has_any).sum())
        if removed:
            dropped["ohne jede Zwischenzeit (DNS)"] = removed
        out = out[has_any]

    return out.reset_index(drop=True), dropped


# ---------------------------------------------------------------------------
# Wide-Aufbau
# ---------------------------------------------------------------------------

def build_wide(df_raw: pd.DataFrame, cfg: dict, year: int) -> tuple[pd.DataFrame, dict]:
    identity, stations, unmapped = map_columns(df_raw, cfg)

    out = pd.DataFrame(index=df_raw.index)
    out["year"] = year

    def _col(logical: str, default=np.nan):
        src = identity.get(logical)
        return df_raw[src] if src else pd.Series(default, index=df_raw.index)

    out["bib"] = pd.to_numeric(_col("bib"), errors="coerce").astype("Int64")
    out["name"] = _col("name").astype("string").str.strip()
    out["gender"] = (
        _col("gender").astype("string").str.strip().str.upper().str[:1]
        .replace({"W": "F", "K": "F"})
    )
    out["country"] = _col("country").astype("string").str.strip().str.upper()
    out["club"] = _col("club").astype("string").str.strip()
    # Schreibweise wie in den Vorjahren: 'Black', 'White', 'DNF'
    out["finish_type"] = (
        _col("finish_type").astype("string").str.strip().str.title()
        .replace({"Dnf": "DNF", "Dns": "DNS"})
    )

    # Sekunden-Matrix aller Stationen
    sec = pd.DataFrame(index=df_raw.index, columns=C.STATION_ORDER, dtype="float64")
    for station in C.STATION_ORDER:
        src = stations.get(station)
        if src is not None:
            sec[station] = df_raw[src].map(parse_time_to_seconds)

    mapping_report = {
        "identity": identity,
        "stations": {k: str(v) for k, v in stations.items()},
        "stations_missing": [s for s in C.STATION_ORDER if s not in stations],
        "raw_columns_unmapped": unmapped,
    }
    return out, {"seconds": sec, "report": mapping_report, "identity": identity, "raw": df_raw}


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------

# Stationen, die physisch dieselbe Matte sind: fehlt die erste, darf die zweite
# einspringen. swim_finish und transition_1_in liegen in Eidfjord wenige Meter
# auseinander - in den Altdaten unterscheiden sie sich um ein bis zwei Sekunden.
EQUIVALENT_STATIONS: list[tuple[str, str]] = [
    ("swim_finish", "transition_1_in"),
]


def assign_white_finish(sec: pd.DataFrame, base: pd.DataFrame, raw: pd.DataFrame) -> pd.DataFrame:
    """White-Shirt-Zielzeiten in die richtige Spalte schreiben.

    Die Zeitnahme kennt nur eine Zielmatte. Ob jemand Black oder White bekommt,
    entscheidet die Cut-off-Position, nicht die Matte - 2026 sind 40 spaeter
    als Platz 160 angekommene Athleten ueber die Gausta-Matte gelaufen und
    trotzdem White. Das historische Schema hat dafuer zwei Spalten.
    """
    if "finish_type" not in base.columns:
        return sec
    out = sec.copy()
    white = base["finish_type"].astype("string").str.lower().eq("white").fillna(False)
    if not white.any():
        return out

    finish_time = pd.Series(np.nan, index=out.index)
    if "finish_black_t_shirt" in out.columns:
        finish_time = out["finish_black_t_shirt"]
    if "overall_time" in raw.columns:
        finish_time = finish_time.fillna(raw["overall_time"].map(parse_time_to_seconds))

    if "finish_white_t_shirt" not in out.columns:
        out["finish_white_t_shirt"] = np.nan
    out.loc[white, "finish_white_t_shirt"] = finish_time[white]
    if "finish_black_t_shirt" in out.columns:
        out.loc[white, "finish_black_t_shirt"] = np.nan
    print(f"[transform] {int(white.sum())} White-Shirt-Zielzeiten umgehaengt")
    return out


def backfill_equivalent(sec: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Erste Station aus ihrer Nachbarmatte auffuellen.

    Ohne diesen Schritt bliebe swim_finish leer, wenn die Schwimm-Matte einen
    Athleten nicht erfasst hat - interpolieren laesst sich die erste Station
    nicht, weil links kein Ankerwert existiert.
    """
    out = sec.copy()
    log: list[dict] = []
    for target, source in EQUIVALENT_STATIONS:
        if target not in out.columns or source not in out.columns:
            continue
        mask = out[target].isna() & out[source].notna()
        if not mask.any():
            continue
        out.loc[mask, target] = out.loc[mask, source]
        for idx in out.index[mask]:
            log.append({
                "row": int(out.index.get_loc(idx)),
                "station": target,
                "between": f"uebernommen von {source}",
                "value_s": float(out.loc[idx, target]),
            })
    return out, log


def _segment_weights(sec: pd.DataFrame, stations: list[str]) -> np.ndarray:
    """Median-Segmentdauer des Feldes je Teilstueck. Fallback: Distanz."""
    weights = np.zeros(len(stations) - 1, dtype=float)
    for i in range(len(stations) - 1):
        a, b = stations[i], stations[i + 1]
        delta = sec[b] - sec[a]
        delta = delta[delta > 0]
        if len(delta) >= 5:
            weights[i] = float(delta.median())
        else:
            dist = abs(C.STATION_CUM_KM.get(b, 0.0) - C.STATION_CUM_KM.get(a, 0.0))
            weights[i] = max(dist, 0.01) * 120.0  # grobe Ersatzannahme
    weights[weights <= 0] = 0.01
    return weights


def interpolate(sec: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list[dict]]:
    """Fuellt fehlende Zwischenzeiten zwischen zwei bekannten Stationen.

    Die Luecke wird nicht linear nach Distanz verteilt, sondern nach der
    Median-Segmentdauer des Feldes. Auf Zombie Hill dauert ein Kilometer
    deutlich laenger als in der Ebene - das bildet die Feld-Median-Gewichtung ab,
    eine reine Distanz-Interpolation nicht.
    """
    stations = [s for s in C.STATION_ORDER if s in sec.columns]
    stations = [s for s in stations if s not in C.NON_INTERPOLATABLE]
    weights = _segment_weights(sec, stations)

    filled = sec.copy()
    flags = pd.DataFrame(False, index=sec.index, columns=sec.columns)
    log: list[dict] = []

    values = sec[stations].to_numpy(dtype=float)

    for row_idx in range(values.shape[0]):
        row = values[row_idx]
        known = np.flatnonzero(~np.isnan(row))
        if len(known) < 2:
            continue
        for k in range(len(known) - 1):
            i, j = known[k], known[k + 1]
            if j - i < 2:
                continue
            gap = row[j] - row[i]
            if gap <= 0:
                continue  # kaputte Chronologie -> Validierung kuemmert sich darum
            w = weights[i:j]
            share = np.cumsum(w) / w.sum()
            for offset, pos in enumerate(range(i + 1, j)):
                new_value = row[i] + gap * share[offset]
                filled.iat[row_idx, filled.columns.get_loc(stations[pos])] = new_value
                flags.iat[row_idx, flags.columns.get_loc(stations[pos])] = True
                log.append(
                    {
                        "row": int(row_idx),
                        "station": stations[pos],
                        "between": f"{stations[i]} -> {stations[j]}",
                        "value_s": float(new_value),
                    }
                )
    return filled, flags, log


# ---------------------------------------------------------------------------
# Leg-Zeiten, Raenge, Wide-Ausgabe
# ---------------------------------------------------------------------------

def _diff(sec: pd.DataFrame, a: str, b: str) -> pd.Series:
    if a not in sec.columns or b not in sec.columns:
        return pd.Series(np.nan, index=sec.index)
    d = sec[b] - sec[a]
    return d.where(d >= 0)


def add_leg_times(base: pd.DataFrame, sec: pd.DataFrame, identity_raw: pd.DataFrame) -> pd.DataFrame:
    """Leg-Summen bevorzugt aus der Zeitnahme uebernehmen, sonst aus Stationen rechnen."""
    out = base.copy()

    computed = {
        "swim_time": sec.get("swim_finish"),
        "t1_time": _diff(sec, "transition_1_in", "bike_start"),
        "bike_time": _diff(sec, "bike_start", "bike_180km_finish"),
        "t2_time": _diff(sec, "bike_180km_finish", "run_start"),
        "zombie_hill_time": _diff(sec, "run_25km_zombie_hill_base", "run_32_5km_langefonn"),
    }

    finish = sec["finish_black_t_shirt"] if "finish_black_t_shirt" in sec else pd.Series(np.nan, index=sec.index)
    if "finish_white_t_shirt" in sec:
        finish = finish.fillna(sec["finish_white_t_shirt"])
    computed["run_time"] = (finish - sec["run_start"]).where(lambda s: s >= 0) if "run_start" in sec else np.nan
    computed["overall_time"] = finish

    for col, values in computed.items():
        series = pd.Series(values, index=out.index) if values is not None else pd.Series(np.nan, index=out.index)
        # Wenn die Zeitnahme eine eigene Leg-Spalte geliefert hat, hat diese Vorrang
        if col in identity_raw.columns:
            official = identity_raw[col].map(parse_time_to_seconds)
            series = official.fillna(series)
        out[col + "_s"] = series
    return out


def rank_series(seconds: pd.Series) -> pd.Series:
    return seconds.rank(method="min", na_option="keep")


RANK_COLUMN_OVERRIDES = {"transition_1_in": "transition 1 in_rank"}


def to_wide(base: pd.DataFrame, sec: pd.DataFrame) -> pd.DataFrame:
    """Erzeugt das historische Wide-Layout inkl. aller *_time / *_rank Spalten."""
    out = base[["year", "bib", "name", "gender", "country", "finish_type"]].copy()

    for leg in ["overall", "swim", "t1", "bike", "t2", "run", "zombie_hill"]:
        col = f"{leg}_time_s"
        values = base[col] if col in base.columns else pd.Series(np.nan, index=base.index)
        out[f"{leg}_time"] = values.map(seconds_to_hms)
        out[f"{leg}_rank"] = rank_series(values)

    for station in C.STATION_ORDER:
        if station not in sec.columns:
            continue
        values = sec[station]
        out[f"{station}_time"] = values.map(seconds_to_hms)
        rank_col = RANK_COLUMN_OVERRIDES.get(station, f"{station}_rank")
        out[rank_col] = rank_series(values)

    out["club"] = base["club"] if "club" in base.columns else np.nan
    return out


# ---------------------------------------------------------------------------
# Wide -> Long
# ---------------------------------------------------------------------------

def wide_to_long(wide: pd.DataFrame, sec: pd.DataFrame, flags: pd.DataFrame, n_starters: int) -> pd.DataFrame:
    """Baut das Long-Format (eine Zeile je Athlet x Station)."""
    id_cols = [
        "year", "bib", "name", "gender", "country", "finish_type", "club",
        "overall_time", "overall_rank", "swim_time", "swim_rank",
        "t1_time", "t1_rank", "bike_time", "bike_rank", "t2_time", "t2_rank",
        "run_time", "run_rank", "zombie_hill_time", "zombie_hill_rank",
    ]
    id_cols = [c for c in id_cols if c in wide.columns]

    frames = []
    for station in C.STATION_ORDER:
        if station not in sec.columns:
            continue
        values = sec[station]
        if values.notna().sum() == 0:
            continue
        block = wide[id_cols].copy()
        block["split_key"] = station
        block["split_time"] = values.map(seconds_to_hms).values
        block["split_time_s"] = values.values
        block["split_rank"] = rank_series(values).values
        block["is_interpolated"] = flags[station].values if station in flags.columns else False
        frames.append(block)

    long = pd.concat(frames, ignore_index=True)
    long = long[long["split_time_s"].notna()].copy()

    long["split_rank_relative"] = long["split_rank"] / n_starters
    long["n_starters_year"] = n_starters
    long["split_time_td"] = pd.to_timedelta(long["split_time_s"], unit="s").astype(str)

    long["race_distance_km"] = long["split_key"].map(C.STATION_CUM_KM)
    long["leg"] = long["split_key"].map(_leg_of)
    long["split_distance_km"] = long.apply(_leg_distance, axis=1)

    long = long.sort_values(["year", "bib", "split_time_s"]).reset_index(drop=True)
    long = add_segment_features(long)
    return long


def _leg_of(key: str) -> str:
    if key in C.ZERO_DISTANCE_STATIONS - {"bike_start", "run_start"} or key.startswith("transition"):
        return "transition"
    if key in {"bike_start", "run_start"}:
        return "transition"
    if key.startswith("swim"):
        return "swim"
    if key.startswith("bike"):
        return "bike"
    if key.startswith("run") or key.startswith("finish"):
        return "run"
    return "other"


def _leg_distance(row: pd.Series) -> float:
    cum = row["race_distance_km"]
    if pd.isna(cum):
        return np.nan
    if row["leg"] == "transition":
        return 0.0
    if row["leg"] == "swim":
        return float(cum)
    if row["leg"] == "bike":
        return float(cum - C.SWIM_KM)
    if row["leg"] == "run":
        return float(cum - C.PRE_RUN_KM)
    return np.nan


def add_segment_features(long: pd.DataFrame) -> pd.DataFrame:
    """Segmentzeit, -distanz, -tempo und Rangveraenderung je Athlet.

    Bewusst identisch zur Logik in new_data/neue_features.py, damit 2026 mit
    den Vorjahren vergleichbar bleibt.
    """
    def _per_athlete(group: pd.DataFrame) -> pd.DataFrame:
        group = group.sort_values("split_time_s").copy()

        dist = group["race_distance_km"].ffill().bfill()
        group["race_distance_km"] = dist

        cum_sec = group["split_time_s"].astype(float)
        group["cum_time_seconds"] = cum_sec

        seg_t = cum_sec.diff()
        if len(seg_t):
            seg_t.iloc[0] = cum_sec.iloc[0]
        group["segment_time_s"] = seg_t

        seg_d = dist.diff()
        if len(seg_d):
            seg_d.iloc[0] = dist.iloc[0]
        group["segment_distance_km"] = seg_d

        with np.errstate(divide="ignore", invalid="ignore"):
            speed = seg_d / (seg_t / 3600.0)
        speed = speed.replace([np.inf, -np.inf], np.nan)
        group["segment_speed_kmh"] = speed

        group["delta_rank"] = group["split_rank"].diff().fillna(0)
        group["delta_speed"] = speed.diff().fillna(0)
        return group

    long = long.groupby(["year", "bib"], group_keys=False).apply(_per_athlete)

    long["split_distance_km"] = long["split_distance_km"].round(2)
    long["segment_distance_km"] = long["segment_distance_km"].round(2)
    long["segment_speed_kmh"] = long["segment_speed_kmh"].round(2)
    long["segment_speed_kmh_old"] = long["segment_speed_kmh"]
    long["progress_perc"] = (long["race_distance_km"] / C.COURSE_KM).clip(0, 1)
    return long.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Orchestrierung
# ---------------------------------------------------------------------------

def transform(raw_dir: Path, year: int) -> dict:
    C.ensure_dirs()
    cfg, lists = load_raw(raw_dir)

    list_name, df_raw = pick_best_list(lists, cfg)
    print(f"[transform] Verwendete Ergebnisliste: {list_name} ({len(df_raw)} Zeilen)")

    df_raw, dropped = filter_main_contest(df_raw)
    for reason, count in dropped.items():
        print(f"[transform] {count} Zeilen entfernt: {reason}")

    base, extra = build_wide(df_raw, cfg, year)
    sec_raw: pd.DataFrame = extra["seconds"]
    report = extra["report"]

    print(f"[transform] Stationen erkannt: {len(report['stations'])}/{len(C.STATION_ORDER)}")
    if report["stations_missing"]:
        print(f"[transform] Ohne Zeitnahme-Spalte: {report['stations_missing']}")
    if report["raw_columns_unmapped"]:
        print(f"[transform] Nicht zugeordnete Rohspalten: {report['raw_columns_unmapped']}")

    identity_raw = df_raw.rename(columns={v: k for k, v in extra["identity"].items()})
    sec_raw = assign_white_finish(sec_raw, base, identity_raw)

    sec_pre, backfill_log = backfill_equivalent(sec_raw)
    if backfill_log:
        print(f"[transform] {len(backfill_log)} Zeiten aus der Nachbarmatte uebernommen")

    sec_filled, flags, interp_log = interpolate(sec_pre)
    print(f"[transform] {len(interp_log)} fehlende Zwischenzeiten interpoliert")
    for entry in backfill_log:
        flags.iat[entry["row"], flags.columns.get_loc(entry["station"])] = True
    interp_log = backfill_log + interp_log

    # Starterzahl nach dem Schwimmen (bisher haendisch gepflegt)
    n_starters = int(sec_filled["swim_finish"].notna().sum()) if "swim_finish" in sec_filled else len(base)
    print(f"[transform] Starter nach dem Schwimmen: {n_starters}")

    base = add_leg_times(base, sec_filled, identity_raw)
    wide = to_wide(base, sec_filled)
    long = wide_to_long(wide, sec_filled, flags, n_starters)

    report["n_starters_after_swim"] = n_starters
    report["n_interpolated_cells"] = len(interp_log)
    report["source_list"] = list_name

    (C.REPORT_DIR / f"{year}_mapping_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    pd.DataFrame(interp_log).to_csv(C.REPORT_DIR / f"{year}_interpolation_log.csv", index=False)

    wide.to_csv(C.BUILD_DIR / f"{year}_wide_raw.csv", index=False)
    long.to_csv(C.BUILD_DIR / f"{year}_long_raw.csv", index=False)

    return {
        "wide": wide,
        "long": long,
        "seconds": sec_filled,
        "seconds_raw": sec_raw,
        "identity_raw": identity_raw,
        "flags": flags,
        "report": report,
        "n_starters": n_starters,
    }


if __name__ == "__main__":
    import argparse
    from extract import latest_raw

    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--raw-dir", type=Path, default=None)
    args = ap.parse_args()
    transform(args.raw_dir or latest_raw(args.year), args.year)
