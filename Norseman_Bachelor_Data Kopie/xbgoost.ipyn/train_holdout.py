#!/usr/bin/env python3
"""
XGBoost Black-Shirt-Modell mit einem kompletten Renn-Jahr als Testset.

Unterschied zum Notebook: dort wurde zufaellig 80/20 gesplittet, wodurch
Splits desselben Athleten in Training UND Test landen konnten. Hier ist ein
ganzes Jahr das Testset - das Modell sieht 2026 nie und muss auf ein
unbekanntes Rennen generalisieren.

Features, Encoding und Hyperparameter sind unveraendert aus dem Notebook
uebernommen.

    python train_holdout.py                # Testjahr 2026
    python train_holdout.py --test-year 2025
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    log_loss,
    roc_auc_score,
)
from xgboost import XGBClassifier

HERE = Path(__file__).resolve().parent
DATA_REPO = HERE.parent
PROJECT_ROOT = DATA_REPO.parent


def _find_assets() -> Path:
    for candidate in sorted(PROJECT_ROOT.glob("*/dashboard/assets")):
        if (candidate / "nxtri_data_all_years_long_ready_featured.csv").exists():
            return candidate
    raise SystemExit("dashboard/assets nicht gefunden.")


ASSETS = _find_assets()
LONG_CSV = ASSETS / "nxtri_data_all_years_long_ready_featured.csv"
MODEL_CSV = ASSETS / "xgb_black_probs_long_with_errors.csv"
OUT_DIR = HERE / "holdout_reports"

# --- exakt die Feature-Liste aus dem Notebook --------------------------------
FEATURE_COLS = [
    "year", "split_key", "split_rank", "split_rank_relative",
    "temperature_2m", "cloud_cover", "wind_speed_10m", "precipitation",
    "elev_gain_m", "elev_loss_m", "avg_grade_pct", "wind_effect",
    "n_starters_year", "leg", "split_distance_km", "cum_time_seconds",
    "segment_time_s", "segment_speed_kmh", "delta_rank", "delta_speed",
    "progress_perc",
]
CAT_COLS = ["split_key", "leg"]
# race_distance_km muss mit: split_distance_km ist leg-relativ (Rad bis 180,
# Lauf bis 42), taugt also NICHT zum Sortieren entlang der Rennstrecke.
META_COLS = ["bib", "year", "split_distance_km", "race_distance_km", "split_key", "finish_type"]

# Jahres-Konstanten. Bei einem Jahres-Holdout liegt das Testjahr ausserhalb
# des Trainingsbereichs, XGBoost schiebt es dann in denselben Ast wie das
# letzte Trainingsjahr. Mit --drop-year-features laesst sich das abschalten.
YEAR_LEVEL_COLS = ["year", "n_starters_year"]

PARAMS = dict(
    objective="binary:logistic",
    eval_metric="logloss",
    n_estimators=300,
    learning_rate=0.05,
    max_depth=4,
    min_child_weight=5,
    subsample=0.9,
    colsample_bytree=0.8,
    tree_method="hist",
    random_state=42,
    n_jobs=-1,
)


def load_cutoff_filter():
    """apply_cutoff_filter aus cut-off.py laden (Bindestrich im Dateinamen
    verhindert einen normalen Import) - so bleibt die Cut-off-Logik an einer
    einzigen Stelle definiert."""
    spec = importlib.util.spec_from_file_location("cutoff_mod", HERE / "cut-off.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.apply_cutoff_filter


def build_matrix(df: pd.DataFrame):
    X_raw = df[FEATURE_COLS].copy()
    X_raw["year"] = pd.to_numeric(X_raw["year"], errors="coerce")
    X_raw["split_distance_km"] = pd.to_numeric(X_raw["split_distance_km"], errors="coerce")

    X = pd.get_dummies(X_raw, columns=CAT_COLS, drop_first=True)

    # Wie im Notebook: wind_effect ist ein Text ('headwind'/'tailwind'/
    # 'crosswind') und wird hier zu NaN. Das Feature traegt damit nichts bei -
    # bewusst uebernommen, damit die Ergebnisse vergleichbar bleiben.
    X["wind_effect"] = pd.to_numeric(X["wind_effect"], errors="coerce")
    return X


def athlete_level(df_eval: pd.DataFrame) -> dict:
    """Entscheidung je Athlet am letzten verfuegbaren Split vor dem Cut-off.

    Sortiert wird nach race_distance_km (kumuliert). Mit split_distance_km
    (leg-relativ) landet man sonst beim Rad-Ziel, weil 180 > 37.5."""
    last = df_eval.sort_values(["bib", "race_distance_km"]).groupby("bib").tail(1)
    return {
        "n_athletes": int(len(last)),
        "measured_at": last["split_key"].value_counts().to_dict(),
        "accuracy": float(accuracy_score(last["y_true"], last["y_pred"])),
        "roc_auc": float(roc_auc_score(last["y_true"], last["y_proba"]))
        if last["y_true"].nunique() > 1 else float("nan"),
        "confusion": confusion_matrix(last["y_true"], last["y_pred"]).tolist(),
        "n_wrong": int((last["y_true"] != last["y_pred"]).sum()),
    }


def leave_one_year_out(X: pd.DataFrame, y: pd.Series, years: pd.Series):
    """Je Jahr ein eigenes Modell, das dieses Jahr nie gesehen hat.

    Fuer die Diagramme ist das der ehrliche Weg: wuerde man ein einziges
    Modell nehmen und nur 2026 zurueckhalten, waeren 2018-2025 In-Sample
    und damit kuenstlich gut - ein Vergleich der Fehlerquoten ueber die
    Jahre wuerde 2026 systematisch schlechter aussehen lassen, ohne dass
    das Rennen schwerer war."""
    proba = np.full(len(X), np.nan)
    per_year = []

    for year in sorted(years.unique()):
        mask = (years == year).to_numpy()
        model = XGBClassifier(**PARAMS)
        model.fit(X[~mask], y[~mask])
        p = model.predict_proba(X[mask])[:, 1]
        proba[mask] = p

        y_true = y[mask]
        pred = (p >= 0.5).astype(int)
        per_year.append({
            "year": int(year),
            "n_rows": int(mask.sum()),
            "black_share": round(float(y_true.mean()), 3),
            "accuracy": round(float(accuracy_score(y_true, pred)), 4),
            "roc_auc": round(float(roc_auc_score(y_true, p)), 4)
            if y_true.nunique() > 1 else float("nan"),
            "log_loss": round(float(log_loss(y_true, p)), 4),
            "missed_black": int(((y_true == 1) & (pred == 0)).sum()),
            "false_black": int(((y_true == 0) & (pred == 1)).sum()),
        })

    return proba, pd.DataFrame(per_year)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-year", type=int, default=2026)
    ap.add_argument("--write-dashboard-csv", action="store_true",
                    help="xgb_black_probs_long_with_errors.csv neu schreiben")
    ap.add_argument("--drop-year-features", action="store_true",
                    help="year und n_starters_year weglassen (kein Extrapolieren)")
    ap.add_argument("--leave-one-year-out", action="store_true",
                    help="je Jahr ein Modell ohne dieses Jahr; alle Jahre out-of-sample")
    args = ap.parse_args()
    test_year = args.test_year

    OUT_DIR.mkdir(exist_ok=True)

    print(f"Lade {LONG_CSV.name}")
    df = pd.read_csv(LONG_CSV, low_memory=False)
    print(f"Rohdaten: {df.shape}, Jahre: {sorted(df['year'].dropna().astype(int).unique())}")

    df = load_cutoff_filter()(df)

    df = df[df["finish_type"].isin(["Black", "White"])].copy()
    df["label_black"] = (df["finish_type"] == "Black").astype(int)
    print(f"\nNur Black/White: {df.shape}")

    if test_year not in set(df["year"].astype(int)):
        raise SystemExit(f"Jahr {test_year} nicht in den Daten.")

    X = build_matrix(df)
    if args.drop_year_features:
        X = X.drop(columns=[c for c in YEAR_LEVEL_COLS if c in X.columns])
        print(f"Ohne Jahres-Features: {YEAR_LEVEL_COLS}")
    y = df["label_black"]
    meta = df[META_COLS].copy()
    if "name" in df.columns:
        meta["name"] = df["name"]

    if args.leave_one_year_out:
        years = df["year"].astype(int)
        print(f"\nLeave-one-year-out ueber {sorted(years.unique())} "
              f"- {years.nunique()} Modelle")
        proba_all, per_year = leave_one_year_out(X, y, years)

        print("\n" + "=" * 78)
        print("Jedes Jahr vorhergesagt von einem Modell, das es nie gesehen hat")
        print("=" * 78)
        print(per_year.to_string(index=False))

        pred_all = (proba_all >= 0.5).astype(int)
        print(f"\nGesamt out-of-sample: Accuracy {accuracy_score(y, pred_all):.4f} | "
              f"ROC AUC {roc_auc_score(y, proba_all):.4f}")
        per_year.to_csv(OUT_DIR / "leave_one_year_out_metrics.csv", index=False)

        if args.write_dashboard_csv:
            # Alle Zeilen sind out-of-sample, also alle als "test" markiert -
            # Dashboard und Frontend filtern genau darauf.
            write_dashboard(df, y, proba_all, np.full(len(df), "test"))

        print(f"\nReports: {OUT_DIR}")
        return 0

    is_test = df["year"].astype(int) == test_year
    X_train, X_test = X[~is_test], X[is_test]
    y_train, y_test = y[~is_test], y[is_test]
    meta_test = meta[is_test]

    print(f"\nTrain: {X_train.shape} (Jahre {sorted(df.loc[~is_test,'year'].astype(int).unique())})")
    print(f"Test : {X_test.shape} (Jahr {test_year})")
    print(f"Black-Anteil Train: {y_train.mean():.3f} | Test: {y_test.mean():.3f}")

    model = XGBClassifier(**PARAMS)
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    metrics = {
        "test_year": test_year,
        "n_rows_train": int(len(X_train)),
        "n_rows_test": int(len(X_test)),
        "black_share_train": float(y_train.mean()),
        "black_share_test": float(y_test.mean()),
        "split_level": {
            "accuracy": float(accuracy_score(y_test, pred)),
            "roc_auc": float(roc_auc_score(y_test, proba)),
            "pr_auc": float(average_precision_score(y_test, proba)),
            "log_loss": float(log_loss(y_test, proba)),
            "brier": float(brier_score_loss(y_test, proba)),
            "confusion": confusion_matrix(y_test, pred).tolist(),
            "baseline_majority": float(max(y_test.mean(), 1 - y_test.mean())),
        },
    }

    df_eval = meta_test.copy()
    df_eval["y_true"] = y_test.values
    df_eval["y_proba"] = proba
    df_eval["y_pred"] = pred
    df_eval["error"] = (df_eval["y_true"] != df_eval["y_pred"]).astype(int)
    metrics["athlete_level"] = athlete_level(df_eval)

    print("\n" + "=" * 62)
    print(f"TESTJAHR {test_year} - Split-Ebene ({len(X_test)} Zeilen)")
    print("=" * 62)
    s = metrics["split_level"]
    print(f"Accuracy   : {s['accuracy']:.4f}   (Mehrheitsklasse: {s['baseline_majority']:.4f})")
    print(f"ROC AUC    : {s['roc_auc']:.4f}")
    print(f"PR AUC     : {s['pr_auc']:.4f}")
    print(f"Log Loss   : {s['log_loss']:.4f}")
    print(f"Brier      : {s['brier']:.4f}")
    print(f"\nConfusion (Zeilen wahr, Spalten Vorhersage):\n{np.array(s['confusion'])}")
    print(f"\n{classification_report(y_test, pred, target_names=['White', 'Black'], digits=4)}")

    a = metrics["athlete_level"]
    print("=" * 62)
    print(f"Athleten-Ebene - Entscheidung am letzten Split vor dem Cut-off")
    print("=" * 62)
    print(f"Gemessen an: {a['measured_at']}")
    print(f"Athleten   : {a['n_athletes']}")
    print(f"Accuracy   : {a['accuracy']:.4f}  ({a['n_wrong']} falsch)")
    print(f"ROC AUC    : {a['roc_auc']:.4f}")
    print(f"Confusion  :\n{np.array(a['confusion'])}")

    # Fehlerrate je Streckenpunkt
    by_split = (df_eval.groupby(["split_distance_km", "split_key"])["error"]
                .agg(["mean", "size"]).reset_index()
                .sort_values("split_distance_km"))
    by_split.columns = ["split_distance_km", "split_key", "error_rate", "n"]
    by_split.to_csv(OUT_DIR / f"{test_year}_error_rate_by_split.csv", index=False)

    print("\nFehlerrate entlang der Strecke (Auszug):")
    print(by_split.assign(error_rate=lambda d: (d["error_rate"] * 100).round(1))
          .rename(columns={"error_rate": "fehler_%"})
          .to_string(index=False, max_rows=40))

    # Kalibrierung
    bins = pd.cut(df_eval["y_proba"], np.linspace(0, 1, 11), include_lowest=True)
    calib = df_eval.groupby(bins, observed=True).agg(
        n=("y_true", "size"), vorhergesagt=("y_proba", "mean"), tatsaechlich=("y_true", "mean")
    ).round(3)
    calib.to_csv(OUT_DIR / f"{test_year}_calibration.csv")
    print("\nKalibrierung:")
    print(calib.to_string())

    df_eval.sort_values(["bib", "split_distance_km"]).to_csv(
        OUT_DIR / f"{test_year}_predictions.csv", index=False)
    (OUT_DIR / f"{test_year}_metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8")

    # Feature-Wichtigkeit
    imp = (pd.DataFrame({"feature": X_train.columns, "gain": model.feature_importances_})
           .sort_values("gain", ascending=False))
    imp.to_csv(OUT_DIR / f"{test_year}_feature_importance.csv", index=False)
    print("\nWichtigste Features (gain):")
    print(imp.head(12).to_string(index=False))

    if args.write_dashboard_csv:
        proba_all = np.empty(len(X)); proba_all[:] = np.nan
        proba_all[is_test.values] = proba
        proba_all[~is_test.values] = model.predict_proba(X_train)[:, 1]
        write_dashboard(df, y, proba_all, np.where(is_test.values, "test", "train"))

    print(f"\nReports: {OUT_DIR}")
    return 0


def write_dashboard(df: pd.DataFrame, y: pd.Series, proba_all, set_labels) -> None:
    """Modell-CSV fuer Dashboard und Frontend schreiben.

    Beide filtern auf set == "test" - nur diese Zeilen landen in den
    Diagrammen."""
    out = pd.DataFrame({
        "year": df["year"].astype(int),
        "bib": df["bib"],
        "name": df["name"] if "name" in df.columns else "",
        "finish_type": df["finish_type"].str.lower(),
        "split_key": df["split_key"],
        "leg": df["leg"],
        "race_distance_km": df["race_distance_km"],
        "cum_time_seconds": df["cum_time_seconds"],
        "segment_speed_kmh": df["segment_speed_kmh"],
        "split_rank": df["split_rank"],
        "split_rank_relative": df["split_rank_relative"],
        "y_true": y.values,
        "p_black": proba_all,
    })
    out["y_pred"] = (out["p_black"] >= 0.5).astype(int)
    out["is_error"] = (out["y_true"] != out["y_pred"]).astype(int)
    out["error_type"] = np.where(
        out["is_error"] == 0, "correct",
        np.where(out["y_true"] == 1, "missed_black", "false_black"))
    out["set"] = set_labels

    if MODEL_CSV.exists():
        backup = MODEL_CSV.with_suffix(".csv.bak")
        MODEL_CSV.replace(backup)
        print(f"\nSicherung der alten Datei: {backup.name}")

    out.to_csv(MODEL_CSV, index=False)
    print(f"Dashboard-Datei geschrieben: {MODEL_CSV}")
    print(f"  Jahre: {sorted(out['year'].unique())}, {len(out)} Zeilen, "
          f"davon in den Diagrammen sichtbar: {int((out['set'] == 'test').sum())}")


if __name__ == "__main__":
    raise SystemExit(main())
