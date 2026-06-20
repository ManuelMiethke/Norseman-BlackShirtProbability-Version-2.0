import pandas as pd
from pathlib import Path

# =======================
# Einstellungen
# =======================

# Eingabedatei (alle Jahre, wide-Format)
INPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/new_nxtri_data_all_years.csv"   # <--- anpassen

# Ausgabedatei
OUTPUT_CSV = "nxtri_data_all_years_imingfjell_fixed.csv"

# Spaltennamen für die beiden Splits (ggf. anpassen)
COL_142 = "bike_142km_top_imingfjell_time"
COL_152 = "bike_152km_end_imingfjell_time"

# Bereich für die Berechnung des Median-Segments (in Minuten)
MEDIAN_MIN_MINUTES = 20   # untere Grenze für Median-Berechnung
MEDIAN_MAX_MINUTES = 90   # obere Grenze für Median-Berechnung

# Grenze, ab wann wir korrigieren (zu schnelle Werte, in Minuten)
OUTLIER_MAX_MINUTES = 20  


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
    print(f" Daten geladen: {df.shape[0]} Zeilen, {df.shape[1]} Spalten\n")

    # Prüfen, ob die benötigten Spalten existieren
    missing_cols = [c for c in [COL_142, COL_152] if c not in df.columns]
    if missing_cols:
        raise KeyError(f"Folgende Spalten fehlen in der CSV: {missing_cols}")

    # Zeiten in Timedelta umwandeln
    t142 = to_td(df[COL_142])
    t152 = to_td(df[COL_152])

    # Segmentdauer berechnen (152 - 142)
    segment = t152 - t142
    seg_minutes = segment.dt.total_seconds() / 60

    print("=== STATISTIK VOR KORREKTUR (Bike 142 -> 152) ===")
    print(f"Anzahl Segmentdauern (nicht NaT): {segment.notna().sum()}")
    print("Segmentdauer in Minuten (5%, 50%, 95% Quantil):")
    print(seg_minutes.dropna().quantile([0.05, 0.5, 0.95]))
    print()

    # Plausible Segmente für die Median-Berechnung (20–90 Minuten)
    median_min = MEDIAN_MIN_MINUTES
    median_max = MEDIAN_MAX_MINUTES
    mask_median_range = seg_minutes.between(median_min, median_max)

    plausible_segment = segment[mask_median_range]

    if not plausible_segment.empty:
        median_seg = plausible_segment.median()
        print(f"Plausible Segmentdauern (für Median): {mask_median_range.sum()}")
        print(
            f"Median-Segmentdauer: {median_seg} "
            f"(~{median_seg.total_seconds() / 60:.1f} Minuten)\n"
        )
    else:
        # Fallback, falls aus irgendeinem Grund nichts im Bereich liegt
        median_seg = pd.Timedelta(minutes=45)
        print("⚠️ Keine plausiblen Segmentdauern im Bereich gefunden, "
              f"nutze Fallback: {median_seg}\n")

    # Ausreißer-Maske: nur *zu schnelle* Segmente (< OUTLIER_MAX_MINUTES)
    # -> langsame Werte bleiben unangetastet
    outlier_threshold = OUTLIER_MAX_MINUTES
    mask_outlier = (
        segment.notna()
        & (seg_minutes < outlier_threshold)
        & t142.notna()
    )

    print("=== KORREKTUR ===")
    print(f"Anzahl zu korrigierender Zeilen (zu schnelle Segmente): {mask_outlier.sum()}")

    # Neue 152-Zeit = 142-Zeit + Median-Segmentdauer
    new_t152 = t142 + median_seg

    # Nur bei Ausreißern überschreiben
    df.loc[mask_outlier, COL_152] = new_t152[mask_outlier].apply(format_td)

    # Statistik nach Korrektur
    t152_fixed = to_td(df[COL_152])
    segment_fixed = t152_fixed - to_td(df[COL_142])
    seg_minutes_fixed = segment_fixed.dt.total_seconds() / 60

    print("\n=== STATISTIK NACH KORREKTUR ===")
    print("Segmentdauer in Minuten (5%, 50%, 95% Quantil):")
    print(seg_minutes_fixed.dropna().quantile([0.05, 0.5, 0.95]))

    # Datei speichern
    out_path = Path(OUTPUT_CSV)
    df.to_csv(out_path, index=False)
    print(f"\n Bereinigte Datei gespeichert als: {out_path.resolve()}")


if __name__ == "__main__":
    main()
