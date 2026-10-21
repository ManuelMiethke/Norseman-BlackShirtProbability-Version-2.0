#!/usr/bin/env python3
"""
Modell-Datei fuer das React-Dashboard (Seite "Model Predictions").

Kombiniert zwei Modelllaeufe zu einer Datei, damit alle Jahre sichtbar sind:

* 2018-2025: frueheres Modell aus dem Notebook (zufaelliger 80/20-Split je
  Zeile). Quelle: xgb_black_probs_random_split.csv (eingefrorene Kopie der
  damaligen xgb_black_probs_long_with_errors.csv).
* 2026: Holdout-Lauf aus train_holdout.py (ganzes Jahr als Testset).
  Quelle: xgb_black_probs_long_with_errors.csv, nur year == 2026.

Die Spalte "set" bleibt erhalten (Diagramme filtern auf "test"); die neue
Spalte "model" sagt, aus welchem Lauf eine Zeile stammt.

    python build_dashboard_model_csv.py
"""
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ASSETS = next(p for p in sorted(HERE.parent.parent.glob("*/dashboard/assets"))
              if (p / "xgb_black_probs_long_with_errors.csv").exists())

OLD_MODEL_CSV = ASSETS / "xgb_black_probs_random_split.csv"
HOLDOUT_CSV = ASSETS / "xgb_black_probs_long_with_errors.csv"
OUT_CSV = ASSETS / "xgb_black_probs_dashboard.csv"
HOLDOUT_YEAR = 2026


def main() -> int:
    old = pd.read_csv(OLD_MODEL_CSV, low_memory=False)
    old = old[old["year"].astype(int) != HOLDOUT_YEAR].copy()
    old["model"] = "random_split"

    holdout = pd.read_csv(HOLDOUT_CSV, low_memory=False)
    holdout = holdout[holdout["year"].astype(int) == HOLDOUT_YEAR].copy()
    holdout["model"] = "holdout_2026"

    out = pd.concat([old, holdout], ignore_index=True)
    out.to_csv(OUT_CSV, index=False)

    summary = out.groupby(["year", "model", "set"]).size().unstack("set", fill_value=0)
    print(f"Geschrieben: {OUT_CSV.name} ({len(out)} Zeilen)")
    print(summary.to_string())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
