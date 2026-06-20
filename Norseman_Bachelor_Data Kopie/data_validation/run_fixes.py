import pandas as pd
from pathlib import Path

# =======================
# Einstellungen
# =======================

# Eingabedatei (nach Bike-Cleaning)
INPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_validated.csv"   # <-- anpassen

# Ausgabedatei
OUTPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_everything_val.csv"

# Relevante Run-Segmente: (from_col, to_col, dist_km)
RUN_SEGMENTS = [
    ("run_5km_atraa_time",             "run_10km_time",                  5.0),
    ("run_10km_time",                  "run_15km_tinnsjo_time",          5.0),
    ("run_15km_tinnsjo_time",          "run_20km_miland_time",           5.0),
    ("run_20km_miland_time",           "run_25km_zombie_hill_base_time", 5.0),
    ("run_25km_zombie_hill_base_time", "run_32_5km_langefonn_time",      7.5),
    # falls du weitere Splits korrigieren willst, hier ergänzen
]

# Realistischer Pacebereich für Median-Berechnung (min/km)
MIN_PACE_FOR_MEDIAN = 3.0   # schneller als 3:00 min/km = eher unrealistisch
MAX_PACE_FOR_MEDIAN = 20.0  # langsamer als 15:00 min/km -> nicht für Median, aber OK

# Grenze, ab wann wir korrigieren (zu schnelle Werte, min/km)
OUTLIER_PACE_MAX = 3.0      # alles darunter wird als "too fast" korrigiert


def to_td(s):
    """String -> Timedelta, tolerant gegenüber NaN/leer."""
    return pd.to_timedelta(s, errors="coerce")


def format_td(td: pd.Timedelta) -> str:
    """Timedelta -> 'H:MM:SS' (ohne Tage)."""
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours}:{minutes:02d}:{seconds:02d}"


def main():
    path = Path(INPUT_CSV)
    if not path.exists():
        raise FileNotFoundError(f"Eingabedatei nicht gefunden: {path.resolve()}")

    print(f"📁 Lade Daten von: {path.resolve()}")
    df = pd.read_csv(path)
    print(f"✅ Daten geladen: {df.shape[0]} Zeilen, {df.shape[1]} Spalten\n")

    for from_col, to_col, dist_km in RUN_SEGMENTS:
        print(f"=== Segment: {from_col} -> {to_col} ({dist_km} km) ===")

        if from_col not in df.columns or to_col not in df.columns:
            print(f"⚠️ Spalten nicht gefunden, überspringe Segment.\n")
            continue

        t_from = to_td(df[from_col])
        t_to   = to_td(df[to_col])

        # Segmentdauer & Pace
        seg = t_to - t_from
        valid = seg.notna() & t_from.notna()

        seg_minutes = seg.dt.total_seconds() / 60.0
        pace_min_per_km = seg_minutes / dist_km

        print(f"Anzahl gültiger Segmentzeiten: {valid.sum()}")
        if valid.sum() == 0:
            print()
            continue

        # Statistik vor Korrektur
        print("Pace (min/km) vor Korrektur (5%, 50%, 95% Quantil):")
        print(pace_min_per_km[valid].quantile([0.05, 0.5, 0.95]))

        # Median nur aus plausiblen Pacen
        mask_median = (
            valid
            & (pace_min_per_km >= MIN_PACE_FOR_MEDIAN)
            & (pace_min_per_km <= MAX_PACE_FOR_MEDIAN)
        )
        plausible_seg = seg[mask_median]

        if plausible_seg.empty:
            median_seg = pd.Timedelta(minutes=6 * dist_km)  # Fallback: z.B. 6:00 min/km
            print(f"⚠️ Keine plausiblen Werte für Median gefunden,"
                  f" nutze Fallback: {median_seg} (~{median_seg.total_seconds()/60:.1f} min)\n")
        else:
            median_seg = plausible_seg.median()
            print(f"Plausible Beobachtungen für Median: {mask_median.sum()}")
            print(f"Median Segmentdauer: {median_seg} "
                  f"(~{median_seg.total_seconds()/60:.1f} min => "
                  f"{(median_seg.total_seconds()/60)/dist_km:.2f} min/km)\n")

        # Outlier: nur zu schnelle Paces (< OUTLIER_PACE_MAX)
        mask_outlier = valid & (pace_min_per_km < OUTLIER_PACE_MAX)

        print(f"Anzahl zu korrigierender Zeilen (too fast): {mask_outlier.sum()}")

        if mask_outlier.any():
            new_to = t_from + median_seg
            df.loc[mask_outlier, to_col] = new_to[mask_outlier].apply(format_td)

            # Kurze Statistik nach Korrektur
            t_to_fixed = to_td(df[to_col])
            seg_fixed = t_to_fixed - t_from
            pace_fixed = (seg_fixed.dt.total_seconds() / 60.0) / dist_km

            print("Pace nach Korrektur (5%, 50%, 95% Quantil):")
            print(pace_fixed[valid].quantile([0.05, 0.5, 0.95]))
        print()

    # Datei speichern
    out_path = Path(OUTPUT_CSV)
    df.to_csv(out_path, index=False)
    print(f"✅ Bereinigte Datei gespeichert als: {out_path.resolve()}")


if __name__ == "__main__":
    main()
