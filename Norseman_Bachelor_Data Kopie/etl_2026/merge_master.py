"""
Merge-Schritt: das neue Renn-Jahr in die Master-Dateien des Dashboards schreiben.

Eigenschaften
-------------
* idempotent  - ein erneuter Lauf ersetzt das Jahr, statt es zu duplizieren
* schema-treu - die Spalten der Master-Datei geben die Reihenfolge vor
* sicher      - vor jedem Schreibvorgang wird eine Sicherung angelegt
"""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

import pandas as pd

import config as C


def _backup(path: Path) -> Path:
    C.ensure_dirs()
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    target = C.BACKUP_DIR / f"{path.stem}_{stamp}{path.suffix}"
    shutil.copy2(path, target)
    return target


def align_to_master(new: pd.DataFrame, master_columns: list[str]) -> tuple[pd.DataFrame, dict]:
    """Neue Daten auf das Master-Schema bringen."""
    missing = [c for c in master_columns if c not in new.columns]
    extra = [c for c in new.columns if c not in master_columns]

    aligned = new.reindex(columns=master_columns)
    return aligned, {"missing_in_new": missing, "extra_in_new": extra}


def merge_into(master_path: Path, new: pd.DataFrame, year: int, dry_run: bool = False) -> dict:
    if master_path is None or not Path(master_path).exists():
        raise FileNotFoundError(f"Master-Datei nicht gefunden: {master_path}")

    master = pd.read_csv(master_path, low_memory=False)
    aligned, diff = align_to_master(new, list(master.columns))

    before = len(master)
    master = master[master["year"] != year]
    removed = before - len(master)

    combined = pd.concat([master, aligned], ignore_index=True)
    sort_cols = [c for c in ["year", "bib", "split_time_td", "split_key"] if c in combined.columns]
    if sort_cols:
        combined = combined.sort_values(sort_cols, kind="stable").reset_index(drop=True)

    info = {
        "file": str(master_path),
        "rows_before": before,
        "rows_replaced": removed,
        "rows_added": len(aligned),
        "rows_after": len(combined),
        **diff,
    }

    if dry_run:
        info["written"] = False
        return info

    backup = _backup(Path(master_path))
    combined.to_csv(master_path, index=False)
    info["written"] = True
    info["backup"] = str(backup)
    return info


def merge(wide: pd.DataFrame, long: pd.DataFrame, year: int, dry_run: bool = False) -> dict:
    if C.MASTER_WIDE is None or C.MASTER_LONG is None:
        raise FileNotFoundError(
            "Dashboard-Assets nicht gefunden. Erwartet wird ein Ordner "
            "*/dashboard/assets/nxtri_data_all_years.csv unterhalb von "
            f"{C.PROJECT_ROOT}"
        )

    results = {
        "wide": merge_into(C.MASTER_WIDE, wide, year, dry_run),
        "long": merge_into(C.MASTER_LONG, long, year, dry_run),
    }

    for kind, info in results.items():
        print(f"[merge] {kind}: {info['rows_before']} -> {info['rows_after']} Zeilen "
              f"(+{info['rows_added']}, ersetzt {info['rows_replaced']})")
        if info["missing_in_new"]:
            print(f"[merge]   Spalten ohne Werte fuer {year}: {info['missing_in_new']}")
        if info["extra_in_new"]:
            print(f"[merge]   Zusaetzliche Spalten (nicht uebernommen): {info['extra_in_new']}")
    return results


def registry_snippet(year: int, n_starters: int, cutoff_key: str, cutoff_km: float, finish_km: float) -> str:
    """Eintrag fuer RACE_YEAR_REGISTRY in dashboard/core/config.py."""
    return f"""    {year}: RaceYearConfig(
        race_id="norseman",
        race_name="Norseman Xtreme Triathlon",
        location="Eidfjord, Norway",
        year={year},
        distance_label="Xtreme Full Distance",
        cutoff_run_km={cutoff_km},
        cutoff_split_key="{cutoff_key}",
        finish_distance_km={finish_km},
        starters_after_swim={n_starters},
        result_source="RACE RESULT / RaceTracker (automatisierte ETL)",
        import_status="available",
        notes=("{cutoff_km} km Black/White decision year",),
    ),"""
