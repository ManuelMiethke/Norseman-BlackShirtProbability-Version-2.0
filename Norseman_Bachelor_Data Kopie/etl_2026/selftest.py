#!/usr/bin/env python3
"""
Selbsttest der ETL - laeuft ohne Internet und ohne echte Renndaten.

    python selftest.py

Prueft die Bausteine, die am ehesten still kaputtgehen koennen:
Zeitparser, Interpolation, Listen-Parser, Validierung, Schema-Angleich.
"""
from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import config as C
import transform as T
import validate as V
import merge_master as M
import enrich as E

FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "ok  " if condition else "FEHL"
    print(f"[{status}] {name}" + (f" - {detail}" if detail and not condition else ""))
    if not condition:
        FAILED.append(name)


# ---------------------------------------------------------------------------

def test_time_parsing() -> None:
    cases = {
        "5:23:11": 19391.0, "23:11": 1391.0, "1:02:03.5": 3723.5,
        "11:22:10": 40930.0, "0:00:01": 1.0,
    }
    for raw, expected in cases.items():
        check(f"parse '{raw}'", T.parse_time_to_seconds(raw) == expected,
              f"erhielt {T.parse_time_to_seconds(raw)}")
    for raw in ["", "-", "–", "DNF", "DNS", None, np.nan, "kaputt"]:
        check(f"parse leer '{raw}'", pd.isna(T.parse_time_to_seconds(raw)))

    check("format 3692", T.seconds_to_hms(3692) == "01:01:32")
    check("format 40930", T.seconds_to_hms(40930) == "11:22:10")
    check("roundtrip", T.parse_time_to_seconds(T.seconds_to_hms(19391)) == 19391.0)


def _synthetic_seconds(n: int = 40) -> pd.DataFrame:
    """Realistisches Zeit-Raster ueber alle Stationen."""
    rng = np.random.default_rng(42)
    stations = C.STATION_ORDER[:-1]  # ohne white shirt
    pace = np.linspace(1.0, 1.8, n)
    rows = []
    for factor in pace:
        row = {}
        t = 0.0
        prev_km = 0.0
        for st in stations:
            km = C.STATION_CUM_KM[st]
            leg = T._leg_of(st)
            speed = {"swim": 3.2, "bike": 28.0, "run": 9.0, "transition": 1.0}[leg]
            dt = (km - prev_km) / speed * 3600.0 * factor
            dt = max(dt, 90.0) if leg == "transition" else dt
            # Rauschen auf die Segmentdauer, nie negativ -> Chronologie bleibt intakt
            dt = max(dt * (1.0 + rng.normal(0, 0.02)), 5.0)
            t += dt
            row[st] = t
            prev_km = km
        rows.append(row)
    df = pd.DataFrame(rows, columns=C.STATION_ORDER)
    df["finish_white_t_shirt"] = np.nan
    return df


def test_interpolation() -> None:
    sec = _synthetic_seconds()
    truth = sec.copy()

    holes = [("bike_47km_halne", 3), ("bike_66km_haugastol", 3),
             ("run_zombie_hill_2nd_turn", 7), ("run_zombie_hill_3rd_turn", 7)]
    for station, row in holes:
        sec.iat[row, sec.columns.get_loc(station)] = np.nan

    filled, flags, log = T.interpolate(sec)

    check("Interpolation fuellt alle Loecher", len(log) == len(holes), f"{len(log)} statt {len(holes)}")
    check("Flags gesetzt", int(flags.to_numpy().sum()) == len(holes))

    for station, row in holes:
        got = filled.iat[row, filled.columns.get_loc(station)]
        want = truth.iat[row, truth.columns.get_loc(station)]
        err = abs(got - want) / max(want, 1) * 100
        check(f"Interpolation {station} < 3% Abweichung", err < 3.0, f"{err:.2f}%")

    stations = [s for s in C.STATION_ORDER if s in filled.columns]
    diffs = filled[stations].diff(axis=1).iloc[:, 1:]
    check("Ergebnis monoton", bool((diffs.fillna(0) >= -1e-6).all().all()))

    # Fuehrende/abschliessende Luecken duerfen nicht gefuellt werden (DNF)
    dnf = sec.copy()
    dnf.iloc[0, dnf.columns.get_loc("run_20km_miland"):] = np.nan
    filled_dnf, _, _ = T.interpolate(dnf)
    tail = filled_dnf.iloc[0][["run_25km_zombie_hill_base", "finish_black_t_shirt"]]
    check("DNF bleibt leer", bool(tail.isna().all()))


def test_list_parser() -> None:
    payload = {
        "list": {"Fields": [
            {"Label": "Bib"}, {"Label": "Name"}, {"Label": "Nation"},
            {"Label": "Bike - 6 km Øvre Eidfjord"}, {"Label": "Finish - 42km Mount Gausta (Black finish)"},
        ]},
        "data": {
            "#1_Men": [["101", "101", "Ola NORDMANN", "NOR", "1:12:03", "10:05:48"]],
            "#2_Women": [["102", "102", "Kari NORDMANN", "NOR", "1:15:00", "11:00:23"]],
        },
    }
    df = T.list_to_frame(payload)
    check("Listen-Parser: Zeilen", len(df) == 2, f"{len(df)}")
    check("Listen-Parser: Record-ID erkannt", "_record_id" in df.columns)
    check("Listen-Parser: Gruppen zusammengefuehrt", set(df["Name"]) == {"Ola NORDMANN", "Kari NORDMANN"})

    cfg = {"splits": [
        {"ID": 5, "Name": "OVRE_EIDFJORD", "Label": "Bike - 6 km Øvre Eidfjord"},
        {"ID": 38, "Name": "FINISH_BLACK", "Label": "Finish - 42km Mount Gausta (Black finish)"},
    ]}
    identity, stations, unmapped = T.map_columns(df, cfg)
    check("Spalten-Mapping: Station mit Umlaut", stations.get("bike_6km_ovre_eidfjord") is not None)
    check("Spalten-Mapping: Finish", stations.get("finish_black_t_shirt") is not None)
    check("Spalten-Mapping: bib", identity.get("bib") is not None)
    check("Spalten-Mapping: name", identity.get("name") is not None)


def test_station_guessing() -> None:
    # Zeitnahme benennt eine Station um -> Fallback ueber Kilometer
    guessed = T._guess_station({"Name": "NEUER_NAME", "Label": "Bike - 47 km Halne Fjellstue"})
    check("Fallback erkennt 47 km Halne", guessed == "bike_47km_halne", str(guessed))
    far = T._guess_station({"Name": "X", "Label": "Bike - 160 km Nirgendwo"})
    check("Fallback lehnt unbekannte Station ab", far is None, str(far))


def test_validation() -> None:
    sec = _synthetic_seconds()
    wide = pd.DataFrame({"year": 2026, "bib": range(1, len(sec) + 1),
                         "name": [f"A{i}" for i in range(len(sec))]})

    # gezielt kaputte Werte
    sec.iat[1, sec.columns.get_loc("bike_66km_haugastol")] = sec.iat[1, sec.columns.get_loc("bike_47km_halne")] - 600
    sec.iat[2, sec.columns.get_loc("run_10km")] = sec.iat[2, sec.columns.get_loc("run_5km_atraa")] + 20

    result = V.validate(sec, wide, 2026, apply_fixes=True)
    checks = set(result.issues["check"]) if not result.issues.empty else set()
    check("Validierung findet Chronologie-Fehler", "chronology" in checks, str(checks))
    check("Validierung findet Tempo-Fehler", "segment_speed" in checks, str(checks))
    check("Auto-Fix hat korrigiert", result.summary["n_autofixed"] > 0)

    fixed = result.seconds
    stations = [s for s in C.STATION_ORDER if s in fixed.columns]
    diffs = fixed[stations].diff(axis=1).iloc[:, 1:]
    check("Nach Auto-Fix monoton", bool((diffs.fillna(0) >= -1e-6).all().all()))


def test_long_format() -> None:
    sec = _synthetic_seconds(n=12)
    base = pd.DataFrame({
        "year": 2026, "bib": range(1, 13), "name": [f"A{i}" for i in range(12)],
        "gender": "M", "country": "NOR", "finish_type": "Black", "club": None,
    })
    base = T.add_leg_times(base, sec, pd.DataFrame(index=sec.index))
    wide = T.to_wide(base, sec)
    check("Wide: Rang-Sonderspalte", "transition 1 in_rank" in wide.columns)
    check("Wide: overall_time gesetzt", wide["overall_time"].notna().all())

    flags = pd.DataFrame(False, index=sec.index, columns=sec.columns)
    long = T.wide_to_long(wide, sec, flags, n_starters=12)
    for col in ["split_key", "split_time", "split_rank", "split_rank_relative", "leg",
                "split_distance_km", "race_distance_km", "cum_time_seconds",
                "segment_time_s", "segment_distance_km", "segment_speed_kmh",
                "delta_rank", "delta_speed", "progress_perc", "n_starters_year"]:
        check(f"Long enthaelt {col}", col in long.columns)
    check("Long: Zeilen pro Athlet", len(long) > 12 * 30, f"{len(long)}")
    check("Long: progress_perc in [0,1]", bool(long["progress_perc"].between(0, 1).all()))
    check("Long: Radtempo plausibel",
          bool(long.loc[long["leg"] == "bike", "segment_speed_kmh"].median() > 10))

    long = E.attach_elevation(long)
    long["wind_direction_10m"] = 180.0  # Wind aus Sueden -> Gegenwind auf dem Marathon
    long = E.attach_wind(long)
    check("Windeffekt gesetzt", long["wind_effect"].notna().any())
    check("Windeffekt korrekt klassifiziert",
          set(long.loc[long["leg"] == "run", "wind_effect"].dropna()) == {"headwind"},
          str(set(long.loc[long["leg"] == "run", "wind_effect"].dropna())))
    check("Hoehenmeter gejoint", long["elev_gain_m"].notna().any())


def test_identity_guard() -> None:
    """Regression: details/view erwartet die Startnummer, nicht die Datensatz-ID.

    Mit der Datensatz-ID bekommt man plausible Splits vom falschen Athleten.
    Der Namensabgleich muss das erkennen.
    """
    import extract as X

    identity = {
        "2": {"bib": "2", "record_id": "2", "name": "Kristian GRUE"},
        "5": {"bib": "5", "record_id": "6", "name": "Alistair BROWNLEE"},
        "4": {"bib": "4", "record_id": "5", "name": "Helena KOTOPULU"},
    }
    details = {
        "2": {"name": "Kristian Grue"},
        "5": {"name": "Alistair Brownlee"},
        "4": {"name": "Helena Kotopulu"},
    }

    result = X.verify_identity(identity, details)
    check("Namensabgleich akzeptiert korrekte Paarung", result["mismatched"] == 0, str(result))

    # Akzentschreibweise darf nicht stoeren
    check("Namensabgleich ignoriert Akzente",
          bool(X._name_key("Andrea Rösch") & X._name_key("Andrea ROESCH".replace("OE", "ö"))))

    # Nach Datensatz-ID gepaart -> muss abbrechen
    shifted = {entry["record_id"]: entry for entry in identity.values()}
    try:
        X.verify_identity(shifted, details)
        check("Namensabgleich erkennt vertauschte Schluessel", False, "kein Abbruch")
    except X.ExtractError:
        check("Namensabgleich erkennt vertauschte Schluessel", True)


def test_master_alignment() -> None:
    new = pd.DataFrame({"year": [2026], "bib": [1], "neu": ["x"]})
    aligned, diff = M.align_to_master(new, ["year", "bib", "name"])
    check("Alignment: Spaltenreihenfolge", list(aligned.columns) == ["year", "bib", "name"])
    check("Alignment: fehlende Spalte gemeldet", diff["missing_in_new"] == ["name"])
    check("Alignment: zusaetzliche Spalte gemeldet", diff["extra_in_new"] == ["neu"])


def test_paths() -> None:
    check("split_points_lat_and_long.csv gefunden", C.SPLIT_POINTS_CSV.exists(), str(C.SPLIT_POINTS_CSV))
    check("weather_stations.csv gefunden", C.WEATHER_STATIONS_CSV.exists(), str(C.WEATHER_STATIONS_CSV))
    check("split_elevation_grade.csv gefunden", C.SPLIT_ELEVATION_CSV.exists(), str(C.SPLIT_ELEVATION_CSV))
    check("Dashboard-Assets gefunden", C.DASHBOARD_ASSETS is not None, str(C.PROJECT_ROOT))
    if C.MASTER_WIDE and C.MASTER_WIDE.exists():
        header = pd.read_csv(C.MASTER_WIDE, nrows=0).columns.tolist()
        sec = _synthetic_seconds(n=3)
        base = pd.DataFrame({"year": 2026, "bib": [1, 2, 3], "name": "x", "gender": "M",
                             "country": "NOR", "finish_type": "Black", "club": None})
        base = T.add_leg_times(base, sec, pd.DataFrame(index=sec.index))
        wide = T.to_wide(base, sec)
        missing = [c for c in header if c not in wide.columns]
        check("Wide deckt Master-Schema ab", not missing, f"fehlt: {missing}")


def main() -> int:
    for test in [test_time_parsing, test_interpolation, test_list_parser,
                 test_station_guessing, test_validation, test_long_format,
                 test_identity_guard, test_master_alignment, test_paths]:
        print(f"\n--- {test.__name__} ---")
        try:
            test()
        except Exception as exc:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            FAILED.append(f"{test.__name__} (Exception: {exc})")

    print("\n" + "=" * 60)
    if FAILED:
        print(f"{len(FAILED)} Pruefung(en) fehlgeschlagen:")
        for name in FAILED:
            print(f"  - {name}")
        return 1
    print("Alle Pruefungen bestanden.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
