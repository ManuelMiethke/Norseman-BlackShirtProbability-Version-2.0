#!/usr/bin/env python3
"""
Norseman ETL - ein Befehl von der Zeitnahme bis in die Master-Dateien.

Typischer Ablauf am Tag nach dem Rennen:

    python run_pipeline.py --year 2026

Vorher testen, ohne etwas zu ueberschreiben:

    python run_pipeline.py --year 2026 --dry-run

Nur nachsehen, was die Zeitnahme gerade liefert:

    python run_pipeline.py --year 2026 --probe
"""
from __future__ import annotations

import argparse
import json
import sys
import traceback
from datetime import datetime
from pathlib import Path

import pandas as pd

import config as C


def main() -> int:
    ap = argparse.ArgumentParser(description="Norseman ETL")
    ap.add_argument("--year", type=int, default=C.TARGET_YEAR)
    ap.add_argument("--event-id", type=int, default=None,
                    help="RACE-RESULT-Event-ID manuell setzen (sonst automatisch)")
    ap.add_argument("--race-date", type=str, default=None, help="YYYY-MM-DD")
    ap.add_argument("--probe", action="store_true", help="Nur API-Struktur anzeigen")
    ap.add_argument("--dry-run", action="store_true", help="Master-Dateien nicht schreiben")
    ap.add_argument("--skip-extract", action="store_true", help="Vorhandene Rohdaten verwenden")
    ap.add_argument("--skip-weather", action="store_true")
    ap.add_argument("--no-autofix", action="store_true", help="Nur melden, nichts korrigieren")
    ap.add_argument("--raw-dir", type=Path, default=None)
    args = ap.parse_args()

    C.ensure_dirs()
    year = args.year
    race_date = args.race_date or C.RACE_DATES.get(year)
    if race_date is None:
        print(f"Kein Renndatum fuer {year} bekannt - bitte --race-date setzen.", file=sys.stderr)
        return 2

    import extract
    import transform
    import validate as validation
    import enrich as enrichment
    import merge_master

    if args.probe:
        extract.probe(year, args.event_id)
        return 0

    # 1) Extract -----------------------------------------------------------
    if args.skip_extract or args.raw_dir:
        raw_dir = args.raw_dir or extract.latest_raw(year)
        print(f"[1/5] Extract uebersprungen, nutze {raw_dir}")
    else:
        print("[1/5] Extract")
        raw_dir = extract.extract(year, args.event_id)

    # 2) Transform ---------------------------------------------------------
    print("[2/5] Transform")
    result = transform.transform(raw_dir, year)
    wide, long = result["wide"], result["long"]
    sec = result["seconds"]

    # 3) Validate ----------------------------------------------------------
    print("[3/5] Validierung")
    vr = validation.validate(sec, wide, year, apply_fixes=not args.no_autofix)
    print(f"[3/5] {vr.summary['n_issues']} Auffaelligkeiten "
          f"({vr.summary['n_hard']} hart, {vr.summary['n_soft']} weich), "
          f"{vr.summary['n_autofixed']} korrigiert")

    if vr.summary["n_autofixed"]:
        # Nach den Korrekturen Zeiten, Raenge und Long-Format neu aufbauen
        sec = vr.seconds
        wide = _rebuild_wide(result, sec, transform)
        long = _rebuild_long(wide, sec, result, transform)

    # 4) Enrich ------------------------------------------------------------
    print("[4/5] Anreicherung")
    long = enrichment.enrich(long, year, race_date, skip_weather=args.skip_weather)

    # 5) Merge -------------------------------------------------------------
    print("[5/5] Merge in die Master-Dateien")
    merge_info = merge_master.merge(wide, long, year, dry_run=args.dry_run)

    snippet = merge_master.registry_snippet(
        year, result["n_starters"], C.RACE_YEAR.cutoff_split_key,
        C.RACE_YEAR.cutoff_run_km, C.RACE_YEAR.finish_distance_km,
    )

    summary = {
        "year": year,
        "race_date": race_date,
        "finished_at": datetime.now().isoformat(timespec="seconds"),
        "raw_dir": str(raw_dir),
        "athletes": int(len(wide)),
        "long_rows": int(len(long)),
        "starters_after_swim": result["n_starters"],
        "validation": vr.summary,
        "mapping": result["report"],
        "merge": merge_info,
        "dry_run": args.dry_run,
    }
    (C.REPORT_DIR / f"{year}_pipeline_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    print("\nFertig.")
    print(f"  Athleten          : {len(wide)}")
    print(f"  Long-Zeilen       : {len(long)}")
    print(f"  Reports           : {C.REPORT_DIR}")
    if args.dry_run:
        print("  (Dry-Run - Master-Dateien wurden NICHT veraendert)")

    _warn_model_gap(year)
    print("\nEintrag fuer dashboard/core/config.py RACE_YEAR_REGISTRY:\n")
    print(snippet)
    return 0


def _warn_model_gap(year: int) -> None:
    """dashboard/core/validators.py verlangt, dass Long, Wide und die
    Modell-Datei dieselben Jahre enthalten. Die Modell-Datei entsteht im
    XGBoost-Notebook und wird von dieser Pipeline nicht erzeugt."""
    if C.DASHBOARD_ASSETS is None:
        return
    model_csv = C.DASHBOARD_ASSETS / "xgb_black_probs_long_with_errors.csv"
    if not model_csv.exists():
        return
    try:
        years = set(pd.read_csv(model_csv, usecols=["year"])["year"].dropna().astype(int))
    except Exception:  # noqa: BLE001
        return
    if year not in years:
        print(
            f"\nACHTUNG: {model_csv.name} enthaelt {year} noch nicht.\n"
            f"  validate_dashboard_assets() vergleicht Long/Wide/Modell-Jahre und\n"
            f"  wuerde deshalb fehlschlagen. Bitte xbgoost.ipyn/xgboost.ipynb fuer\n"
            f"  {year} nachziehen, dann passt das Dashboard wieder zusammen."
        )


def _rebuild_wide(result: dict, sec, transform_mod):
    """Wide-Tabelle nach Auto-Fixes neu berechnen."""
    base = result["wide"][["year", "bib", "name", "gender", "country", "finish_type"]].copy()
    if "club" in result["wide"].columns:
        base["club"] = result["wide"]["club"]
    identity_raw = result.get("identity_raw")
    if identity_raw is None:
        identity_raw = pd.DataFrame(index=sec.index)
    base = transform_mod.add_leg_times(base, sec, identity_raw)
    return transform_mod.to_wide(base, sec)


def _rebuild_long(wide, sec, result, transform_mod):
    return transform_mod.wide_to_long(wide, sec, result["flags"], result["n_starters"])


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        print(
            "\nHinweis: Wenn der Fehler aus dem Extract-Schritt kommt, zeigt\n"
            "  python run_pipeline.py --year <jahr> --probe\n"
            "was die Zeitnahme aktuell liefert.",
            file=sys.stderr,
        )
        sys.exit(1)
