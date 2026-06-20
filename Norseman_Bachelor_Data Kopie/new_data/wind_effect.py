"""
Add wind_effect column (headwind / tailwind / crosswind) to Norseman long data.

- Bike Segment A:  bike_start bis bike_94km_kikut  -> Richtung Westen (270°)
- Bike Segment B:  bike_101km_skurdalen bis bike_180km_finish -> Richtung Süden (180°)
- Run (kompletter Marathon): Richtung Süden (180°)
- Swim, T1, T2 etc.: keine Richtung -> wind_effect bleibt leer (NaN)
"""

import pandas as pd

# Pfade
INPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_with_weather_and_elevation.csv"
OUTPUT_CSV = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_with_new_new.csv"


def get_movement_direction(split_key: str) -> float:
    """
    Bestimme die Bewegungsrichtung (in Grad) anhand des split_key.

    270° = Bewegung Richtung Westen
    180° = Bewegung Richtung Süden
    NaN = keine definierte Richtung (z.B. Swim, T1, T2)
    """
    if not isinstance(split_key, str):
        return float("nan")

    # Bike Segment A: Richtung Westen (270°)
    bike_west_keys = {
        "bike_start",
        "bike_6km_ovre_eidfjord",
        "bike_11km_enter_gamlevegen",
        "bike_16km_voringfossen",
        "bike_20km_garen",
        "bike_28km_bjoreio",
        "bike_36km_dyranut",
        "bike_47km_halne",
        "bike_66km_haugastol",
        "bike_90km_geilo",
        "bike_94km_kikut",
    }

    # Bike Segment B: Richtung Süden (180°)
    bike_south_keys = {
        "bike_101km_skurdalen",
        "bike_113km_dagali",
        "bike_123km_vasstulan",
        "bike_134km_start_imingfjell",
        "bike_142km_top_imingfjell",
        "bike_152km_end_imingfjell",
        "bike_180km_finish",
    }

    # Bike-Logik
    if split_key in bike_west_keys:
        return 270.0  # nach Westen
    if split_key in bike_south_keys:
        return 180.0  # nach Süden

    # Run: kompletter Marathon nach Süden
    if split_key.startswith("run"):
        return 180.0

    # Sonst: keine definierte Richtung
    return float("nan")


def classify_wind_effect(row) -> str:
    """
    Classifiziere den Windeffekt relativ zur Bewegungsrichtung.

    - headwind: Wind von vorne (relativer Winkel <= 45° oder >= 315°)
    - tailwind: Wind von hinten (relativer Winkel zwischen 135° und 225°)
    - crosswind: ansonsten
    """
    move_dir = row["movement_direction_deg"]
    wind_dir = row["wind_direction_10m"]

    # Fehlende Daten => keine Klassifikation
    if pd.isna(move_dir) or pd.isna(wind_dir):
        return pd.NA

    # relative Richtung: woher kommt der Wind im Vergleich zur Bewegungsrichtung?
    rel = (wind_dir - move_dir + 360) % 360

    # Gegenwind (von vorne)
    if rel <= 45 or rel >= 315:
        return "headwind"

    # Rückenwind (von hinten)
    if 135 <= rel <= 225:
        return "tailwind"

    # Alles dazwischen: Seitenwind
    return "crosswind"


def main():
    print(f"Lade Daten aus: {INPUT_CSV}")
    df = pd.read_csv(INPUT_CSV, low_memory=False)

    # Bewegungsrichtung anhand des split_key bestimmen
    df["movement_direction_deg"] = df["split_key"].apply(get_movement_direction)

    # Windeffekt klassifizieren
    df["wind_effect"] = df.apply(classify_wind_effect, axis=1)

    # Speichern
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Fertig! Neue Datei mit wind_effect gespeichert unter:\n{OUTPUT_CSV}")

    print("\nBeispiel value_counts von wind_effect:")
    print(df["wind_effect"].value_counts(dropna=False).head())


if __name__ == "__main__":
    main()
