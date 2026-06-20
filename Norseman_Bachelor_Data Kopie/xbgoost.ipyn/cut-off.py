import argparse
import pandas as pd
from pathlib import Path

# --- Cutoff configuration ----------------------------------------------------

# Years where the Black/White decision is at 32.5 km RUN distance
CUTOFF_RUN_KM_BY_YEAR = {
    2018: 32.5,
    2019: 32.5,
    2021: 32.5,
    2022: 32.5,
}
DEFAULT_CUTOFF_RUN_KM = 37.5

SWIM_KM = 3.8
BIKE_KM = 180.0

# Splits that are after the Black/White decision 
POST_CUTOFF_COMMON = {
    "run_40km_right_before_mt_gaustatoppen",
    "finish_black_t_shirt",
    "finish_white_t_shirt",
}

DIST_COL_CANDIDATES = ["race_distance_km", "cum_dist_km", "cum_dist"]


def apply_cutoff_filter(df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns df_clean (rows kept, i.e., pre-cutoff)
    """

    if "year" not in df.columns or "split_key" not in df.columns:
        raise ValueError("DataFrame must contain columns 'year' and 'split_key'.")

    dist_col = next((c for c in DIST_COL_CANDIDATES if c in df.columns), None)
    if dist_col is None:
        raise ValueError(
            f"No distance column found. Tried: {DIST_COL_CANDIDATES}. "
            "Please ensure one exists (e.g., 'race_distance_km')."
        )

    dist = pd.to_numeric(df[dist_col], errors="coerce")

    cutoff_run_km = df["year"].map(CUTOFF_RUN_KM_BY_YEAR).fillna(DEFAULT_CUTOFF_RUN_KM)

    max_dist = dist.max(skipna=True)
    is_total_distance = bool(max_dist > 100)  

    if is_total_distance:
        cutoff_km = SWIM_KM + BIKE_KM + cutoff_run_km  
    else:
        cutoff_km = cutoff_run_km 

    mask = df["split_key"].isin(POST_CUTOFF_COMMON)
    mask |= dist > cutoff_km

    df_clean = df.loc[~mask].copy()

    # Logging checks
    print("\n=== Cutoff configuration ===")
    print("Run cutoff per year (km):", CUTOFF_RUN_KM_BY_YEAR, "| default:", DEFAULT_CUTOFF_RUN_KM)
    print(f"Leg constants for TOTAL-distance mode: swim={SWIM_KM} km, bike={BIKE_KM} km")

    print("\n=== Distance column detection ===")
    print(f"Distance column used: {dist_col}")
    print(f"Max {dist_col}: {max_dist:.2f}")
    print(f"Interpreting as: {'TOTAL race distance' if is_total_distance else 'RUN-only distance'}")

    print("\n=== Cutoff km per year (as applied to chosen distance column) ===")
    tmp = (
        df[["year"]]
        .drop_duplicates()
        .assign(
            cutoff_run_km=lambda x: x["year"].map(CUTOFF_RUN_KM_BY_YEAR).fillna(DEFAULT_CUTOFF_RUN_KM),
        )
    )
    if is_total_distance:
        tmp["cutoff_used_km"] = SWIM_KM + BIKE_KM + tmp["cutoff_run_km"]
    else:
        tmp["cutoff_used_km"] = tmp["cutoff_run_km"]

    print(tmp.sort_values("year").to_string(index=False))

    print("\n=== Row counts ===")
    print(f"Rows before: {len(df)}")
    print(f"Rows after : {len(df_clean)}")
    print(f"Rows removed: {len(df) - len(df_clean)}")

    last_splits = df_clean.groupby("year")["split_key"].agg(lambda s: s.value_counts().index[0])
    print("\nMost common last split_key remaining per year (quick sanity):")
    print(last_splits.sort_index().to_string())

    return df_clean


def main():
    parser = argparse.ArgumentParser(description="Apply Norseman cutoff logic to long data.")
    parser.add_argument(
        "--input",
        type=str,
        default="/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_ready_featured.csv",
        help="Path to input CSV (long format with features).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="/Users/manuelmiethke/Norseman_Bachelor/nxtri_data_all_years_long_ready_featured_cutoff_clean.csv",
        help="Path for cleaned output CSV.",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    print(f"Loading data from: {input_path}")
    df = pd.read_csv(input_path, low_memory=False)

    df_clean = apply_cutoff_filter(df)

    print(f"\nSaving cleaned data to: {output_path}")
    df_clean.to_csv(output_path, index=False)

    print("\nDone.")


if __name__ == "__main__":
    main()
