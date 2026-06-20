import pandas as pd
import numpy as np

# -------------------------------------------------------------------
# 1. Datei laden
# -------------------------------------------------------------------
INPUT_FILE = "new_data/nxtri_data_all_years_validated.csv"
OUTPUT_FILE_CORRECTED = "nxtri_data_all_years_validated_ranks_fixed.csv"
OUTPUT_FILE_CHANGES = "nxtri_rank_changes.csv"

df = pd.read_csv(INPUT_FILE)

# -------------------------------------------------------------------
# 2. Alle Zeit- und Rank-Spalten finden und zuordnen
# -------------------------------------------------------------------
# Zeitspalten: alle *_time plus die "Haupt"-Spalten
time_cols = [
    c for c in df.columns
    if c.endswith("_time") or c in [
        "overall_time", "swim_time", "t1_time",
        "bike_time", "t2_time", "run_time", "zombie_hill_time"
    ]
]

# Rankspalten: alle *_rank plus die "Haupt"-Spalten
rank_cols = [
    c for c in df.columns
    if c.endswith("_rank") or c in [
        "overall_rank", "swim_rank", "t1_rank",
        "bike_rank", "t2_rank", "run_rank", "zombie_hill_rank"
    ]
]

# Mapping: Zeitspalte -> zugehörige Rankspalte
time_to_rank = {}
for t in time_cols:
    base = t.replace("_time", "")
    candidates = [
        r for r in rank_cols
        if r == base + "_rank" or r == base.replace("_", " ") + "_rank"
    ]
    if len(candidates) == 1:
        time_to_rank[t] = candidates[0]
    else:
        # Falls etwas nicht eindeutig ist, kannst du dir das später ansehen
        print(f"[WARN] Keine eindeutige Rankspalte für {t}: {candidates}")

print(f"Gefundene Zeit/Rank-Paare: {len(time_to_rank)}")

# -------------------------------------------------------------------
# 3. Ränge pro Jahr aus Zeiten neu berechnen
# -------------------------------------------------------------------
df_ranks = df.copy()

for time_col, rank_col in time_to_rank.items():
    # Name der neuen Spalte für den berechneten Rang
    comp_col = "computed_" + rank_col.replace(" ", "_")
    df_ranks[comp_col] = np.nan

    # Nur Zeilen mit einer Zeit
    nonnull_idx = df_ranks.index[df_ranks[time_col].notna()]

    # Gruppierung nach Jahr (Ränge sind immer innerhalb eines Rennjahrs)
    for year, idx in df_ranks.loc[nonnull_idx].groupby("year").groups.items():
        # Zeiten in Timedelta konvertieren
        times = pd.to_timedelta(df_ranks.loc[idx, time_col], errors="coerce")

        # NaN (z.B. DNF an diesem Split) rausfiltern
        valid_idx = idx[times.notna()]
        if len(valid_idx) == 0:
            continue

        valid_times = times.loc[valid_idx]

        # Rang: 1 = schnellste Zeit; ties -> gleicher Rang (method='min')
        ranks = valid_times.rank(method="min").astype(int)

        # In neue Spalte schreiben
        df_ranks.loc[valid_idx, comp_col] = ranks

    print(f"Ränge neu berechnet für: {time_col} -> {rank_col}")

# -------------------------------------------------------------------
# 4. Alle Abweichungen (Änderungen) sammeln
# -------------------------------------------------------------------
changes = []

for time_col, rank_col in time_to_rank.items():
    comp_col = "computed_" + rank_col.replace(" ", "_")

    if comp_col not in df_ranks.columns:
        continue

    orig = pd.to_numeric(df_ranks[rank_col], errors="coerce")
    new = pd.to_numeric(df_ranks[comp_col], errors="coerce")

    # Nur Zeilen, wo beide Werte existieren
    mask_valid = orig.notna() & new.notna()

    if not mask_valid.any():
        continue

    # Vergleich nur auf diesen validen Zeilen,
    # damit es keinen Ärger mit NaNs beim Casten gibt
    orig_valid = orig[mask_valid].round().astype(int)
    new_valid = new[mask_valid].round().astype(int)

    diff_mask = orig_valid != new_valid
    if diff_mask.any():
        changed_idx = orig_valid.index[diff_mask]

        diff_df = df_ranks.loc[changed_idx, [
            "year", "bib", "name", time_col, rank_col, comp_col
        ]].copy()
        diff_df["split"] = time_col
        diff_df["old_rank"] = diff_df[rank_col]
        diff_df["new_rank"] = diff_df[comp_col]

        # Nur die wichtigsten Spalten für die Änderungen
        diff_df = diff_df[[
            "year", "bib", "name", "split",
            time_col, "old_rank", "new_rank"
        ]]

        changes.append(diff_df)

        print(
            f"Änderungen bei {time_col}: {len(diff_df)} Zeilen, "
            f"z.B. Jahr {diff_df.iloc[0]['year']}, Bib {diff_df.iloc[0]['bib']}"
        )

# Alles zu einem DataFrame zusammenführen
if changes:
    changes_df = pd.concat(changes, ignore_index=True)
    print(f"Gesamtzahl an Rank-Änderungen: {len(changes_df)}")
    # In eine CSV schreiben, damit du sie dir in Ruhe anschauen kannst
    changes_df.to_csv(OUTPUT_FILE_CHANGES, index=False)
    print(f"Alle Änderungen gespeichert in: {OUTPUT_FILE_CHANGES}")
else:
    print("Keine Rank-Abweichungen gefunden – alles konsistent.")

# -------------------------------------------------------------------
# 5. (Optional) Ränge im Datensatz überschreiben und neue Datei speichern
# -------------------------------------------------------------------
# Wenn du wirklich alle Ränge auf die neu berechneten Werte setzen willst:
overwrite_ranks = True  # auf False setzen, wenn du nur prüfen willst

if overwrite_ranks and changes:
    for time_col, rank_col in time_to_rank.items():
        comp_col = "computed_" + rank_col.replace(" ", "_")
        if comp_col in df_ranks.columns:
            # Nur dort überschreiben, wo wir auch einen neuen Rang berechnet haben
            mask = df_ranks[comp_col].notna()
            df_ranks.loc[mask, rank_col] = df_ranks.loc[mask, comp_col]

    df_ranks.to_csv(OUTPUT_FILE_CORRECTED, index=False)
    print(f"Korrigierter Datensatz gespeichert als: {OUTPUT_FILE_CORRECTED}")
else:
    print("Ränge wurden NICHT überschrieben (overwrite_ranks=False oder keine Änderungen).")
