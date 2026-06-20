import pandas as pd
from pathlib import Path


def load_suspects(csv_path="suspect_splits.csv") -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(path.resolve())
    df = pd.read_csv(path)
    print(f"Loaded {df.shape[0]} suspect rows.\n")
    return df


def compute_split_station_distribution(sus: pd.DataFrame) -> pd.DataFrame:
    """
    Welche Split-Stationen erzeugen wie viele verdächtige Segmente?
    """
    sus["split_key"] = sus["from_col"] + " → " + sus["to_col"]
    counts = sus["split_key"].value_counts().reset_index()
    counts.columns = ["split_key", "count"]

    total = counts["count"].sum()
    counts["percent_of_all_suspects"] = (counts["count"] / total * 100).round(2)

    return counts


def compute_split_station_distribution_by_issue(sus: pd.DataFrame) -> pd.DataFrame:
    """
    Welche Splits erzeugen wie viele 'too_fast' bzw. 'too_slow'?
    """
    sus["split_key"] = sus["from_col"] + " → " + sus["to_col"]

    grouped = (
        sus.groupby(["issue", "split_key"])
        .size()
        .reset_index(name="count")
        .sort_values(["issue", "count"], ascending=[True, False])
    )

    dfs = []
    for issue, df_issue in grouped.groupby("issue"):
        total_issue = df_issue["count"].sum()
        df_issue["percent_of_issue"] = (df_issue["count"] / total_issue * 100).round(2)
        dfs.append(df_issue)

    return pd.concat(dfs, ignore_index=True)


def compute_year_distribution(sus: pd.DataFrame) -> pd.DataFrame:
    if "year" not in sus.columns:
        raise ValueError("Spalte 'year' fehlt in suspect_splits.csv")

    year_counts = sus["year"].value_counts().reset_index()
    year_counts.columns = ["year", "count"]

    total_sus = year_counts["count"].sum()
    year_counts["percent_of_all_suspects"] = (
        year_counts["count"] / total_sus * 100
    ).round(2)

    return year_counts.sort_values("year")


def compute_split_distribution_per_year(sus: pd.DataFrame) -> pd.DataFrame:
    """
    Optional:
    Für jedes Jahr, welche SPLITS die meisten verdächtigen Segmente verursachen.
    """
    sus["split_key"] = sus["from_col"] + " → " + sus["to_col"]

    grouped = (
        sus.groupby(["year", "split_key"])
        .size()
        .reset_index(name="count")
        .sort_values(["year", "count"], ascending=[True, False])
    )

    # Prozentanteile pro Jahr
    dfs = []
    for year, df_year in grouped.groupby("year"):
        total = df_year["count"].sum()
        df_year["percent_within_year"] = (
            df_year["count"] / total * 100
        ).round(2)
        dfs.append(df_year)

    return pd.concat(dfs, ignore_index=True)


def main():
    sus = load_suspects("data_validation/suspect_splits.csv")

    # SPLIT-Verteilung über alle Jahre
    print("=== Verteilung ALLER verdächtigen Splits (overall) ===")
    dist_all = compute_split_station_distribution(sus)
    print(dist_all.head(20))
    dist_all.to_csv("suspect_split_distribution_overall.csv", index=False)
    print("\n📁 gespeichert: suspect_split_distribution_overall.csv\n")

    # Verteilung nach "too_fast" / "too_slow"
    print("=== Verteilung nach Issue-Typ (too_fast / too_slow) ===")
    dist_issue = compute_split_station_distribution_by_issue(sus)
    print(dist_issue.head(20))
    dist_issue.to_csv("suspect_split_distribution_by_issue.csv", index=False)
    print("\n📁 gespeichert: suspect_split_distribution_by_issue.csv\n")

    # Jahresverteilung
    print("=== Anteil der verdächtigen Segmente pro Jahr ===")
    dist_year = compute_year_distribution(sus)
    print(dist_year)
    dist_year.to_csv("suspect_split_distribution_per_year.csv", index=False)
    print("\n📁 gespeichert: suspect_split_distribution_per_year.csv\n")

    # SPLITS pro Jahr (optional)
    print("=== Welche Splits sind in jedem Jahr verdächtig? (per year) ===")
    dist_split_year = compute_split_distribution_per_year(sus)
    print(dist_split_year.head(20))
    dist_split_year.to_csv("suspect_split_distribution_split_per_year.csv", index=False)
    print("\n📁 gespeichert: suspect_split_distribution_split_per_year.csv\n")


if __name__ == "__main__":
    main()
