import pandas as pd
import numpy as np
from pathlib import Path


# -----------------------------
# 1. Daten laden
# -----------------------------

def load_data(csv_path: str) -> pd.DataFrame:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Datei nicht gefunden: {path.resolve()}")
    df = pd.read_csv(path)
    print("✅ Daten geladen")
    print(f"Shape: {df.shape[0]} Zeilen, {df.shape[1]} Spalten\n")
    return df


# -----------------------------
# 2. Basic-Summary & Missing Values
# -----------------------------

def basic_summary(df: pd.DataFrame) -> None:
    print("=== BASIC SUMMARY ===")
    print("\n👉 Datentypen:")
    print(df.dtypes)
    print("\n👉 Missing Values pro Spalte (absteigend sortiert):")
    missing = df.isna().sum().sort_values(ascending=False)
    missing_percent = (missing / len(df) * 100).round(2)
    mv = pd.concat([missing, missing_percent], axis=1)
    mv.columns = ["missing_count", "missing_percent"]
    print(mv)
    print("\n")


def missing_values_report(df: pd.DataFrame, top_n: int = 20) -> None:
    print("=== MISSING VALUES DETAIL ===")
    missing = df.isna().sum()
    missing_percent = (missing / len(df) * 100).round(2)
    mv = pd.concat([missing, missing_percent], axis=1)
    mv.columns = ["missing_count", "missing_percent"]
    mv = mv.sort_values(by="missing_percent", ascending=False)

    print(f"Top {top_n} Spalten mit den meisten Missing Values:")
    print(mv.head(top_n))
    print("\nSpalten ohne Missing Values:")
    print(mv[mv["missing_count"] == 0].index.tolist())
    print("\n")


# -----------------------------
# 3. Time-Parsing-Check für *_time-Spalten
# -----------------------------

def parse_time_series(series: pd.Series) -> pd.Series:
    """
    Versucht, eine Zeitspalte in pandas.Timedelta zu konvertieren.
    Erwartet Formate wie 'H:MM:SS', 'HH:MM:SS', 'M:SS', ggf. leer.
    """
    # Strings erzeugen, aber 'nan' als NaN behandeln
    s = series.astype("string")
    s = s.replace({"": pd.NA, "nan": pd.NA, "NaN": pd.NA})

    # Standard-Pandas-Konvertierung (sehr robust für h:m:s)
    td = pd.to_timedelta(s, errors="coerce")
    return td


def time_parsing_report(df: pd.DataFrame) -> pd.DataFrame:
    print("=== TIME PARSING REPORT ( *_time Spalten ) ===")
    time_cols = [c for c in df.columns if c.endswith("_time")]
    print(f"Gefundene Zeitspalten: {len(time_cols)}")
    print(time_cols, "\n")

    rows = []
    for col in time_cols:
        s = df[col]
        td = parse_time_series(s)

        non_null_mask = s.notna()
        non_null_count = non_null_mask.sum()
        parsed_non_null = td[non_null_mask].notna().sum()
        failed = non_null_count - parsed_non_null

        fail_rate = (failed / non_null_count * 100) if non_null_count > 0 else 0.0

        rows.append({
            "column": col,
            "non_null": int(non_null_count),
            "parsed_ok": int(parsed_non_null),
            "failed_parse": int(failed),
            "failed_percent": round(fail_rate, 2),
        })

    report = pd.DataFrame(rows).sort_values(by="failed_percent", ascending=False)
    print(report)
    print("\nHinweis: Spalten mit >0% failed_parse solltest du dir genauer ansehen.\n")
    return report

def duplicate_report(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Prüft auf:
    1) Exakte Duplikate kompletter Zeilen.
    2) Mehrfache Einträge pro (year, bib).

    Gibt zwei DataFrames zurück:
      - exact_dupes: komplett identische Zeilen
      - key_dupes: Zeilen, bei denen (year, bib) mehrfach vorkommen
    """
    print("=== DUPLICATE CHECK ===")

    # 1) Exakte Duplikate (vollständige Zeile)
    exact_mask = df.duplicated(keep=False)  # alle Duplikate markieren, nicht nur die zweite
    exact_dupes = df.loc[exact_mask].copy()

    print(f"Anzahl Zeilen, die Teil eines EXAKTEN Duplikats sind: {len(exact_dupes)}")
    if not exact_dupes.empty:
        print("\nBeispiele für exakte Duplikate:")
        cols_for_sort = [c for c in ["year", "bib", "name"] if c in df.columns]
        if cols_for_sort:
            print(exact_dupes.sort_values(cols_for_sort).head(20))
        else:
            print(exact_dupes.head(20))
    else:
        print("✅ Keine exakten Duplikate gefunden.")

    print("\n---\n")

    # 2) Duplikate nach Schlüssel (year, bib)
    key_dupes = pd.DataFrame()
    if {"year", "bib"}.issubset(df.columns):
        key_mask = df.duplicated(subset=["year", "bib"], keep=False)
        key_dupes = df.loc[key_mask].copy()
        print(f"Anzahl Zeilen mit mehrfach vorkommender (year, bib)-Kombination: {len(key_dupes)}")

        if not key_dupes.empty:
            print("\nBeispiele für (year, bib) Duplikate:")
            print(
                key_dupes
                .sort_values(["year", "bib", "name"] if "name" in df.columns else ["year", "bib"])
                .head(30)
            )
        else:
            print("✅ Keine Duplikate mit identischer (year, bib)-Kombination gefunden.")
    else:
        print("⚠️ Spalten 'year' und/oder 'bib' nicht gefunden – Key-Dublettenprüfung übersprungen.")

    print()
    return exact_dupes, key_dupes

# -----------------------------
# 4. Chronologische Konsistenz der Splits
# -----------------------------

def chronological_consistency_check(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prüft, ob die Stationen-Zeiten (cumulative splits) je Athlet monoton nicht fallend sind.
    Nutzt dafür die station-basierten *_time-Spalten von swim_finish bis Finish.
    """
    print("=== CHRONOLOGICAL CONSISTENCY CHECK ===")

    # Alle *_time-Spalten
    time_cols = [c for c in df.columns if c.endswith("_time")]

    # Erster station-basierter Split: swim_finish_time
    if "swim_finish_time" not in time_cols:
        raise ValueError("Spalte 'swim_finish_time' wurde nicht gefunden – bitte Spaltennamen prüfen.")

    first_station_idx = time_cols.index("swim_finish_time")
    station_time_cols = time_cols[first_station_idx:]

    print("Verwendete station-basierte Zeitspalten in Reihenfolge:")
    print(station_time_cols, "\n")

    # In Timedelta konvertieren
    td_df = df[station_time_cols].apply(parse_time_series)

    # Differenzen zwischen aufeinanderfolgenden Stationen
    # Negative Differenz = spätere Station früher als vorherige → Fehler
    diffs = td_df.diff(axis=1)

    # Wir interessieren uns nur für Zeilen, wo beide Zeiten vorhanden sind
    # => diff < 0 & nicht NaT
    neg_mask = diffs < pd.to_timedelta(0)
    neg_mask = neg_mask & diffs.notna()

    problematic_rows, problematic_cols = np.where(neg_mask.values)
    print(f"Anzahl Zeilen mit mindestens einer rückwärts laufenden Zeit: "
          f"{np.unique(problematic_rows).size}")

    # Einen Report bauen: pro Zeile, welche Spalten betroffen sind
    issues = []
    for r in np.unique(problematic_rows):
        cols_with_issue = [station_time_cols[c] for c in np.where(neg_mask.values[r])[0]]
        row_info = {
            "index": int(df.index[r]),
            "year": df.loc[df.index[r], "year"] if "year" in df.columns else None,
            "bib": df.loc[df.index[r], "bib"] if "bib" in df.columns else None,
            "problem_columns": cols_with_issue,
        }
        issues.append(row_info)

    issues_df = pd.DataFrame(issues)
    if not issues_df.empty:
        print("\n⚠️ Gefundene chronologische Probleme (Beispiele):")
        print(issues_df.head(20))
    else:
        print("\n✅ Keine rückwärts laufenden Zeiten in den station-basierten Splits gefunden.")

    print()
    return issues_df

def rank_duplicate_report(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Prüft für jede *_rank-Spalte, ob innerhalb eines Jahres
    ein Rang mehrfach vergeben wurde.
    
    Missing Ranks (NaN) werden ignoriert.
    
    Rückgabe:
      - summary_df: pro (year, column) welche Ränge doppelt sind
      - details_df: betroffene Zeilen (year, bib, name, column, rank)
    """
    if "year" not in df.columns:
        raise ValueError("Spalte 'year' fehlt – ohne Jahr keine sinnvolle Rank-Validierung!")

    rank_cols = [c for c in df.columns if c.endswith("_rank")]
    print(f"=== DUPLICATE RANK CHECK ({len(rank_cols)} Rank-Spalten) ===")

    summary_rows = []
    detail_rows = []

    for col in rank_cols:
        for year, group in df.groupby("year"):
            s = group[col].dropna()
            if s.empty:
                continue

            # Floats → int (z. B. 1.0 → 1)
            ranks_int = s.astype(int)

            # Ränge, die mehr als einmal vorkommen
            vc = ranks_int.value_counts()
            dup_ranks = vc[vc > 1]
            if dup_ranks.empty:
                continue

            # Zusammenfassung auf hoher Ebene
            summary_rows.append({
                "year": year,
                "column": col,
                "n_conflicting_ranks": len(dup_ranks),
                "conflicting_ranks": dup_ranks.to_dict(),  # z.B. {45: 2, 78: 3}
            })

            # Detail-Einträge (welche Athleten sind betroffen?)
            for rank_value, count in dup_ranks.items():
                conflicted_rows = group.loc[ranks_int[ranks_int == rank_value].index]
                for idx, row in conflicted_rows.iterrows():
                    detail_rows.append({
                        "year": year,
                        "column": col,
                        "rank": int(rank_value),
                        "bib": row.get("bib", None),
                        "name": row.get("name", None),
                        "index": idx,
                    })

    if summary_rows:
        print("⚠️ Gefundene doppelte Ränge in Rank-Spalten.\n")
        summary_df = pd.DataFrame(summary_rows).sort_values(["year", "column"])
        details_df = pd.DataFrame(detail_rows).sort_values(["year", "column", "rank"])
    else:
        print("✅ Keine doppelten Ränge gefunden.")
        summary_df = pd.DataFrame()
        details_df = pd.DataFrame()

    return summary_df, details_df


    # Zusammenfassung
    if problems:
        print(f"⚠️ Gefundene Ranking-Probleme: {len(problems)}\n")
        return pd.DataFrame(problems)
    else:
        print("✅ Keine Probleme in den Rank-Spalten gefunden.")
        return pd.DataFrame()



# -----------------------------
# 5. Main
# -----------------------------

def main():
    # Pfad ggf. anpassen
    csv_path = "newest_master_data_excel/nxtri_data_all_years.csv"

    df = load_data(csv_path)

    # Schritt 1: Basic-Summary & Missing Values
    basic_summary(df)
    missing_values_report(df, top_n=25)

    # Schritt 2: Time-Parsing-Check
    time_parsing_report(df)

    # Schritt 3: Chronologische Konsistenz
    chronological_consistency_check(df)

    exact_dupes, key_dupes = duplicate_report(df)

    rank_problems = rank_duplicate_report(df)
    rank_summary, rank_details = rank_duplicate_report(df)

    print("=== RANK SUMMARY (erste 30 Zeilen) ===")
    print(rank_summary.head(30))

    print("\n=== RANK DETAILS (erste 100 Zeilen) ===")
    print(rank_details.head(100))



if __name__ == "__main__":
    main()
