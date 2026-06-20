import pandas as pd

# Pfade 
INPUT_CSV  = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_with_new_new.csv"
OUTPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_ready.csv"

# Starter counts after the swim (your numbers) 
STARTERS_AFTER_SWIM = {
    2018: 242,
    2019: 261,
    2021: 97,
    2022: 233,
    2024: 255,
    2025: 253,
}

def add_split_relative_rank(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Year as int
    df["year"] = df["year"].astype(int)

    # Map starters per year
    df["n_starters_year"] = df["year"].map(STARTERS_AFTER_SWIM)

    # Check for missing years
    missing = df[df["n_starters_year"].isna()]["year"].unique()
    if len(missing) > 0:
        raise ValueError(f"Missing starter counts for years: {missing}")

    # Ensure split_rank is numeric
    df["split_rank"] = pd.to_numeric(df["split_rank"], errors="coerce")

    # Compute relative split rank (no rounding)
    df["split_rank_relative"] = df["split_rank"] / df["n_starters_year"]

    # Put split_rank_relative next to split_rank visually 
    cols = list(df.columns)
    if "split_rank" in cols:
        idx = cols.index("split_rank")
        # Remove existing occurrence of the new column from end
        cols = [c for c in cols if c != "split_rank_relative"]
        # Insert right after split_rank
        cols = cols[:idx+1] + ["split_rank_relative"] + cols[idx+1:]
        df = df[cols]

    return df

if __name__ == "__main__":
    df = pd.read_csv(INPUT_CSV, low_memory=False)
    df_rel = add_split_relative_rank(df)
    df_rel.to_csv(OUTPUT_CSV, index=False)
    print("Done! Saved with relative split ranks next to split_rank:", OUTPUT_CSV)
