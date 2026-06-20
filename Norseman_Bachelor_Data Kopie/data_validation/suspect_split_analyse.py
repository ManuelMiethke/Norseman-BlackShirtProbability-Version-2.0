import pandas as pd
from pathlib import Path


def load_suspect_splits(csv_path: str = "suspect_splits.csv") -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path.resolve()}")

    print(f"📁 Lade Datei: {path.resolve()}")
    df = pd.read_csv(path)
    print(f"✅ suspect_splits geladen: {df.shape[0]} Zeilen, {df.shape[1]} Spalten\n")
    return df


def summarize_issues(df: pd.DataFrame) -> None:
    print("=== ISSUE OVERVIEW ===")
    if "issue" not in df.columns:
        print("⚠️ Spalte 'issue' nicht gefunden.")
        return

    print("\nAnzahl pro Issue-Typ:")
    print(df["issue"].value_counts(), "\n")

    if "discipline" in df.columns:
        print("Anzahl pro Disziplin und Issue:")
        print(df.groupby(["discipline", "issue"]).size())
    print("\n")


def analyze_too_fast(df: pd.DataFrame, top_n: int = 30) -> pd.DataFrame:
    """
    Zeigt die extremsten 'too_fast'-Fälle (höchste Geschwindigkeit).
    Gibt ein DataFrame mit den Top-Fällen zurück.
    """
    print("=== TOO FAST ANALYSIS ===")
    if "issue" not in df.columns:
        print("⚠️ Spalte 'issue' nicht gefunden.")
        return pd.DataFrame()

    fast = df[df["issue"] == "too_fast"].copy()
    if fast.empty:
        print("✅ Keine 'too_fast'-Segmente gefunden.\n")
        return fast

    # Nach Geschwindigkeit sortieren (absteigend)
    if "speed_kmh" in fast.columns:
        fast_sorted = fast.sort_values("speed_kmh", ascending=False)
        print(f"Anzahl 'too_fast'-Segmente: {len(fast_sorted)}\n")
        print("Top Beispiele (höchste Geschwindigkeiten):")
        cols = [
            c for c in [
                "year", "bib", "name", "discipline",
                "from_col", "to_col",
                "segment_km", "segment_time_h",
                "speed_kmh", "pace_min_per_km"
            ] if c in fast_sorted.columns
        ]
        print(fast_sorted[cols].head(top_n))
        print("\n")
        return fast_sorted
    else:
        print("⚠️ Spalte 'speed_kmh' nicht gefunden.")
        return fast


def analyze_too_slow(df: pd.DataFrame, top_n: int = 30) -> pd.DataFrame:
    print("=== TOO SLOW ANALYSIS ===")
    if "issue" not in df.columns:
        print("⚠️ Spalte 'issue' nicht gefunden.")
        return pd.DataFrame()

    slow = df[df["issue"] == "too_slow"].copy()
    if slow.empty:
        print("✅ Keine 'too_slow'-Segmente gefunden.\n")
        return slow

    # Nach Pace sortieren (absteigend = langsamer)
    if "pace_min_per_km" in slow.columns:
        slow_sorted = slow.sort_values("pace_min_per_km", ascending=False)
        print(f"Anzahl 'too_slow'-Segmente: {len(slow_sorted)}\n")
        print("Top Beispiele (langsamste Pace):")
        cols = [
            c for c in [
                "year", "bib", "name", "discipline",
                "from_col", "to_col",
                "segment_km", "segment_time_h",
                "speed_kmh", "pace_min_per_km"
            ] if c in slow_sorted.columns
        ]
        print(slow_sorted[cols].head(top_n))
        print("\n")
        return slow_sorted
    else:
        print("⚠️ Spalte 'pace_min_per_km' nicht gefunden.")
        return slow


def discipline_stats(df: pd.DataFrame) -> None:
    """
    Gibt einfache Statistik der Geschwindigkeiten/Pace pro Disziplin aus.
    Hilft, realistische Bereiche einzuschätzen.
    """
    print("=== DISCIPLINE STATS ===")
    if "discipline" not in df.columns:
        print("⚠️ Spalte 'discipline' nicht gefunden.")
        return

    for disc, g in df.groupby("discipline"):
        print(f"\n--- {disc.upper()} ---")
        if "speed_kmh" in g.columns and g["speed_kmh"].notna().any():
            print("speed_kmh (5%, 50%, 95% Quantile):")
            print(g["speed_kmh"].quantile([0.05, 0.5, 0.95]))
        if "pace_min_per_km" in g.columns and g["pace_min_per_km"].notna().any():
            print("\npace_min_per_km (5%, 50%, 95% Quantile):")
            print(g["pace_min_per_km"].quantile([0.05, 0.5, 0.95]))
    print("\n")


def main():
    # Pfad kannst du anpassen, falls nötig
    csv_path = "/Users/manuelmiethke/Norseman_Bachelor/test_data_2018_master copy.csv"

    sus = load_suspect_splits(csv_path)

    # 1) Überblick über Issues
    summarize_issues(sus)

    # 2) Extrem schnelle Segmente
    fast_sorted = analyze_too_fast(sus, top_n=30)

    # 3) Extrem langsame Segmente
    slow_sorted = analyze_too_slow(sus, top_n=30)

    # 4) Quantile pro Disziplin
    discipline_stats(sus)

    # Optional: die sortierten DataFrames als CSV speichern
    if not isinstance(fast_sorted, pd.DataFrame) or fast_sorted.empty:
        pass
    else:
        fast_sorted.to_csv("2018suspect_splits_too_fast_sorted.csv", index=False)
        print("📁 Gespeichert: suspect_splits_too_fast_sorted.csv")

    if not isinstance(slow_sorted, pd.DataFrame) or slow_sorted.empty:
        pass
    else:
        slow_sorted.to_csv("2018suspect_splits_too_slow_sorted.csv", index=False)
        print("📁 Gespeichert: suspect_splits_too_slow_sorted.csv")


if __name__ == "__main__":
    main()
