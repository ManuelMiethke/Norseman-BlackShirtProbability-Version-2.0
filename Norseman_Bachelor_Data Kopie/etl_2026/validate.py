"""
Validierung: das, was bisher per Augenmass gemacht wurde ("zu schnell? zu
langsam? komische Werte?"), als reproduzierbare Regeln.

Zwei Stufen:
  hart  -> physikalisch unmoeglich, wird automatisch korrigiert
  weich -> auffaellig, wird nur gemeldet

Alles landet in etl_2026/reports/<jahr>_validation_*.csv sowie in einer
Markdown-Zusammenfassung.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

import config as C
from transform import interpolate, rank_series, seconds_to_hms, to_wide, wide_to_long


@dataclass
class ValidationResult:
    seconds: pd.DataFrame
    issues: pd.DataFrame
    fixes: pd.DataFrame
    summary: dict


# ---------------------------------------------------------------------------
# Hilfen
# ---------------------------------------------------------------------------

def _leg_km(station: str) -> tuple[str, float] | None:
    """Station -> (Leg, Kilometer innerhalb des Legs)."""
    cum = C.STATION_CUM_KM.get(station)
    if cum is None:
        return None
    if station.startswith("swim"):
        return "swim", cum
    if station.startswith("bike") or station == "bike_start":
        return "bike", cum - C.SWIM_KM
    if station.startswith("run") or station.startswith("finish"):
        return "run", cum - C.PRE_RUN_KM
    return None


def _grade_lookup() -> dict[str, float]:
    """Durchschnittliche Steigung des Segments, das an einer Station endet.

    Nicht ueber den Stationsnamen, sondern ueber die Kilometrierung: das
    GPX-Profil kennt bike_179km_austbygde gar nicht und schreibt die -3,4 %
    der 27-km-Abfahrt der letzten Station zu. Ueber die Distanz-Ueberlappung
    bekommt jedes Segment die Steigung des Streckenabschnitts, in dem es
    tatsaechlich liegt.
    """
    if not C.SPLIT_ELEVATION_CSV.exists():
        return {}
    seg = pd.read_csv(C.SPLIT_ELEVATION_CSV)
    seg["avg_grade_pct"] = pd.to_numeric(seg["avg_grade_pct"], errors="coerce")

    grades: dict[str, float] = {}
    stations = [s for s in C.STATION_ORDER]
    for prev, station in zip(stations, stations[1:]):
        a, b = _leg_km(prev), _leg_km(station)
        if not a or not b or a[0] != b[0]:
            continue
        leg, lo, hi = a[0], a[1], b[1]
        if hi <= lo:
            continue
        rows = seg[seg["leg"] == leg]
        overlap = (rows[["end_km"]].to_numpy().ravel().clip(max=hi)
                   - rows[["start_km"]].to_numpy().ravel().clip(min=lo)).clip(min=0)
        total = overlap.sum()
        if total <= 0:
            continue
        grades[station] = float((rows["avg_grade_pct"].to_numpy() * overlap).sum() / total)
    return grades


def _bounds_for(station: str, grades: dict[str, float]) -> C.SpeedBounds | None:
    if station in C.ZERO_DISTANCE_STATIONS or station.startswith("transition"):
        return None
    grade = grades.get(station)
    grade = None if grade is None or pd.isna(grade) else float(grade)

    if station.startswith("swim"):
        return C.SPEED_BOUNDS["swim"]
    if station.startswith("bike"):
        if grade is not None and grade >= C.CLIMB_GRADE_PCT:
            return C.SPEED_BOUNDS["bike_climb"]
        if grade is not None and grade <= C.DESCENT_GRADE_PCT:
            return C.SPEED_BOUNDS["bike_descent"]
        return C.SPEED_BOUNDS["bike"]
    if grade is not None and grade >= C.STEEP_GRADE_PCT:
        return C.SPEED_BOUNDS["run_steep"]
    return C.SPEED_BOUNDS["run"]


# ---------------------------------------------------------------------------
# Einzelpruefungen
# ---------------------------------------------------------------------------

def check_chronology(sec: pd.DataFrame) -> pd.DataFrame:
    """Zeiten muessen entlang der Strecke monoton steigen."""
    stations = [s for s in C.STATION_ORDER if s in sec.columns]
    rows = []
    values = sec[stations].to_numpy(dtype=float)
    for r in range(values.shape[0]):
        row = values[r]
        known = np.flatnonzero(~np.isnan(row))
        for a, b in zip(known, known[1:]):
            if row[b] < row[a]:
                rows.append(
                    {
                        "row": r,
                        "check": "chronology",
                        "severity": "hard",
                        "station": stations[b],
                        "detail": f"{stations[b]} liegt vor {stations[a]}",
                        "value": row[b],
                        "reference": row[a],
                    }
                )
    return pd.DataFrame(rows)


def check_speeds(sec: pd.DataFrame, grades: dict[str, float]) -> pd.DataFrame:
    """Segment-Geschwindigkeit gegen leg- und steigungsabhaengige Grenzen."""
    stations = [s for s in C.STATION_ORDER if s in sec.columns]
    rows = []
    for prev, station in zip(stations, stations[1:]):
        bounds = _bounds_for(station, grades)
        if bounds is None:
            continue
        dist = abs(C.STATION_CUM_KM.get(station, np.nan) - C.STATION_CUM_KM.get(prev, np.nan))
        if not dist or pd.isna(dist) or dist <= 0:
            continue
        dt = (sec[station] - sec[prev]) / 3600.0
        speed = dist / dt.where(dt > 0)

        checks = [("hard", (speed > bounds.hard_max) | (speed < bounds.hard_min),
                   "ausserhalb harter Grenzen")]
        # Auf kurzen Segmenten ist die Distanzannahme zu ungenau fuer eine
        # sinnvolle Tempo-Pruefung - dort uebernimmt der MAD-Ausreissertest.
        if dist >= C.SHORT_SEGMENT_KM:
            checks.append(("soft", (speed > bounds.soft_max) | (speed < bounds.soft_min),
                           "auffaellig"))

        for severity, mask, label in checks:
            mask = mask.fillna(False)
            if severity == "soft":
                mask &= ~(((speed > bounds.hard_max) | (speed < bounds.hard_min)).fillna(False))
            for idx in sec.index[mask]:
                rows.append(
                    {
                        "row": int(sec.index.get_loc(idx)),
                        "check": "segment_speed",
                        "severity": severity,
                        "station": station,
                        "detail": f"{prev} -> {station}: {speed[idx]:.1f} km/h {label} "
                                  f"({bounds.hard_min}-{bounds.hard_max})",
                        "value": float(speed[idx]),
                        "reference": float(dist),
                    }
                )
    return pd.DataFrame(rows)


def check_transitions(sec: pd.DataFrame) -> pd.DataFrame:
    rows = []
    pairs = [("transition_1_in", "bike_start", "T1"), ("bike_180km_finish", "run_start", "T2")]
    for a, b, label in pairs:
        if a not in sec.columns or b not in sec.columns:
            continue
        dur = sec[b] - sec[a]
        mask = ((dur < C.T_MIN_SECONDS) | (dur > C.T_MAX_SECONDS)).fillna(False)
        for idx in sec.index[mask]:
            rows.append(
                {
                    "row": int(sec.index.get_loc(idx)),
                    "check": "transition_duration",
                    "severity": "soft",
                    "station": b,
                    "detail": f"{label} dauert {dur[idx]:.0f}s",
                    "value": float(dur[idx]),
                    "reference": np.nan,
                }
            )
    return pd.DataFrame(rows)


def check_duplicates(wide: pd.DataFrame) -> pd.DataFrame:
    rows = []
    if {"year", "bib"}.issubset(wide.columns):
        dup = wide.duplicated(subset=["year", "bib"], keep=False)
        for idx in wide.index[dup]:
            rows.append(
                {
                    "row": int(wide.index.get_loc(idx)),
                    "check": "duplicate_bib",
                    "severity": "hard",
                    "station": "",
                    "detail": f"Startnummer {wide.loc[idx, 'bib']} kommt mehrfach vor",
                    "value": np.nan,
                    "reference": np.nan,
                }
            )
    missing_bib = wide["bib"].isna() if "bib" in wide.columns else pd.Series(dtype=bool)
    for idx in wide.index[missing_bib.fillna(False)]:
        rows.append(
            {
                "row": int(wide.index.get_loc(idx)),
                "check": "missing_bib",
                "severity": "hard",
                "station": "",
                "detail": "Keine Startnummer erkannt",
                "value": np.nan,
                "reference": np.nan,
            }
        )
    return pd.DataFrame(rows)


def check_leading_gaps(sec: pd.DataFrame) -> pd.DataFrame:
    """Zeiten an spaeteren Stationen, aber keine am Schwimmausstieg.

    Rennlogisch unmoeglich: ohne Schwimmen kein Rad. In der Praxis ein
    Matten- oder Chipausfall am Schwimmausstieg und in T1.

    Bewusst 'soft' und nicht 'hard': auto_fix() verwirft harte Werte und
    interpoliert neu. Hier sind die vorhandenen Radzeiten aber echt, und
    die Luecke davor laesst sich nicht interpolieren, weil der Anker vor
    ihr fehlt. Die Meldung ist also ein Hinweis zum Nachschlagen, kein
    Auftrag zum Ueberschreiben.
    """
    stations = [s for s in C.STATION_ORDER if s in sec.columns]
    if not stations:
        return pd.DataFrame()

    rows = []
    for idx in sec.index:
        values = sec.loc[idx, stations]
        known = [s for s in stations if pd.notna(values[s])]
        if not known:
            continue
        first = stations.index(known[0])
        if first == 0:
            continue
        missing = stations[:first]
        rows.append(
            {
                "row": int(sec.index.get_loc(idx)),
                "check": "leading_gap",
                "severity": "soft",
                "station": known[0],
                "detail": f"Erste Zeit erst bei {known[0]}; ohne Messung davor: "
                          f"{', '.join(missing)}",
                "value": float(values[known[0]]),
                "reference": np.nan,
            }
        )
    return pd.DataFrame(rows)


def check_outliers(sec: pd.DataFrame) -> pd.DataFrame:
    """Robuster Ausreisser-Test (MAD) je Segment - faengt 'komische Werte',
    die innerhalb der harten Grenzen liegen."""
    stations = [s for s in C.STATION_ORDER if s in sec.columns]
    rows = []
    for prev, station in zip(stations, stations[1:]):
        delta = (sec[station] - sec[prev]).dropna()
        if len(delta) < 20:
            continue
        med = delta.median()
        mad = (delta - med).abs().median()
        if mad <= 0:
            continue
        z = 0.6745 * (delta - med) / mad
        for idx in delta.index[z.abs() > 6]:
            rows.append(
                {
                    "row": int(sec.index.get_loc(idx)),
                    "check": "segment_outlier",
                    "severity": "soft",
                    "station": station,
                    "detail": f"{prev} -> {station}: {delta[idx]:.0f}s vs Median {med:.0f}s "
                              f"(robuster z={z[idx]:.1f})",
                    "value": float(delta[idx]),
                    "reference": float(med),
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Auto-Fix
# ---------------------------------------------------------------------------

def auto_fix(sec: pd.DataFrame, issues: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Harte Fehler entfernen und die Luecke neu interpolieren.

    Bewusst konservativ: der fehlerhafte Wert wird verworfen und aus den
    Nachbarstationen rekonstruiert. Weiche Auffaelligkeiten bleiben unangetastet.
    """
    if issues.empty:
        return sec, pd.DataFrame()

    hard = issues[(issues["severity"] == "hard") & (issues["station"] != "")]
    if hard.empty:
        return sec, pd.DataFrame()

    fixed = sec.copy()
    records = []
    for _, issue in hard.iterrows():
        station = issue["station"]
        if station not in fixed.columns:
            continue
        if station in C.NON_INTERPOLATABLE:
            # Ziel-/Cut-off-Stationen lassen sich nicht rekonstruieren.
            # Der Wert bleibt stehen und wird nur gemeldet.
            continue
        r = int(issue["row"])
        old = fixed.iat[r, fixed.columns.get_loc(station)]
        if pd.isna(old):
            continue
        fixed.iat[r, fixed.columns.get_loc(station)] = np.nan
        records.append({"row": r, "station": station, "old_s": float(old), "reason": issue["detail"]})

    repaired, flags, _ = interpolate(fixed)
    for rec in records:
        new = repaired.iat[rec["row"], repaired.columns.get_loc(rec["station"])]
        rec["new_s"] = float(new) if pd.notna(new) else np.nan
        rec["old_hms"] = seconds_to_hms(rec["old_s"])
        rec["new_hms"] = seconds_to_hms(rec["new_s"])
    return repaired, pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Orchestrierung
# ---------------------------------------------------------------------------

def validate(sec: pd.DataFrame, wide: pd.DataFrame, year: int, apply_fixes: bool = True) -> ValidationResult:
    C.ensure_dirs()
    grades = _grade_lookup()

    issues = pd.concat(
        [
            check_chronology(sec),
            check_speeds(sec, grades),
            check_transitions(sec),
            check_duplicates(wide),
            check_leading_gaps(sec),
            check_outliers(sec),
        ],
        ignore_index=True,
    )
    if issues.empty:
        issues = pd.DataFrame(columns=["row", "check", "severity", "station", "detail", "value", "reference"])

    # Startnummer/Name an die Meldungen haengen, damit der Report lesbar ist
    if not issues.empty and "bib" in wide.columns:
        issues["bib"] = issues["row"].map(lambda r: wide["bib"].iloc[r] if r < len(wide) else np.nan)
        issues["name"] = issues["row"].map(lambda r: wide["name"].iloc[r] if r < len(wide) else np.nan)

    fixes = pd.DataFrame()
    sec_out = sec
    if apply_fixes:
        sec_out, fixes = auto_fix(sec, issues)

    summary = {
        "n_athletes": int(len(wide)),
        "n_issues": int(len(issues)),
        "n_hard": int((issues["severity"] == "hard").sum()) if not issues.empty else 0,
        "n_soft": int((issues["severity"] == "soft").sum()) if not issues.empty else 0,
        "n_autofixed": int(len(fixes)),
        "by_check": issues["check"].value_counts().to_dict() if not issues.empty else {},
    }

    issues.to_csv(C.REPORT_DIR / f"{year}_validation_issues.csv", index=False)
    fixes.to_csv(C.REPORT_DIR / f"{year}_validation_fixes.csv", index=False)
    _write_markdown(year, summary, issues, fixes)

    return ValidationResult(seconds=sec_out, issues=issues, fixes=fixes, summary=summary)


def _write_markdown(year: int, summary: dict, issues: pd.DataFrame, fixes: pd.DataFrame) -> None:
    lines = [
        f"# Norseman {year} - Datenvalidierung",
        "",
        f"- Athleten: **{summary['n_athletes']}**",
        f"- Auffaelligkeiten gesamt: **{summary['n_issues']}** "
        f"({summary['n_hard']} hart, {summary['n_soft']} weich)",
        f"- Automatisch korrigiert: **{summary['n_autofixed']}**",
        "",
        "## Nach Pruefung",
        "",
    ]
    for check, count in summary["by_check"].items():
        lines.append(f"- `{check}`: {count}")

    if not fixes.empty:
        lines += ["", "## Automatisch korrigierte Werte", "",
                  "| Startnr. | Station | vorher | nachher | Grund |",
                  "| --- | --- | --- | --- | --- |"]
        for _, f in fixes.head(200).iterrows():
            lines.append(
                f"| {f.get('bib', '')} | {f['station']} | {f.get('old_hms','')} | "
                f"{f.get('new_hms','')} | {f['reason']} |"
            )

    soft = issues[issues["severity"] == "soft"] if not issues.empty else pd.DataFrame()
    if not soft.empty:
        lines += ["", "## Zur manuellen Sichtung", "",
                  "| Startnr. | Name | Pruefung | Station | Detail |",
                  "| --- | --- | --- | --- | --- |"]
        for _, s in soft.head(200).iterrows():
            lines.append(
                f"| {s.get('bib','')} | {s.get('name','')} | {s['check']} | {s['station']} | {s['detail']} |"
            )

    (C.REPORT_DIR / f"{year}_validation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
