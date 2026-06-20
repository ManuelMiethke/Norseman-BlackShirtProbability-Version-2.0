import pandas as pd

# Pfade
LONG_FILE = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_with_weather.csv"
SEGMENT_FILE = "/Users/manuelmiethke/Norseman_Bachelor/GPX_data/split_elevation_grade.csv"
OUT_FILE = "/Users/manuelmiethke/Norseman_Bachelor/new_data/nxtri_data_all_years_long_with_weather_and_elevation.csv"

# 1) Long-Daten laden
long_df = pd.read_csv(LONG_FILE, low_memory=False)
print("Long-Daten geladen, Shape:", long_df.shape)

# 2) Segment-/Elevationdaten laden
seg = pd.read_csv(SEGMENT_FILE)
print("Segment-Daten geladen, Shape:", seg.shape)
print("Segment-Spalten:", seg.columns.tolist())

# 3) Aus 'to_split' denselben Key machen wie in long_df['split_key']
#    Beispiel: 'bike_6km_ovre_eidfjord_time' -> 'bike_6km_ovre_eidfjord'
seg["split_key"] = seg["to_split"].astype(str).str.replace("_time$", "", regex=True).str.strip()

# 4) Nur die Spalten behalten, die du brauchst
wanted_cols = [
    "split_key",
    "elev_gain_m",
    "elev_loss_m",
    "net_elev_m",
    "avg_grade_pct"
]
seg = seg[wanted_cols]

# 5) Keys in long_df ebenfalls als String & getrimmt
long_df["split_key"] = long_df["split_key"].astype(str).str.strip()

# 6) Merge: split_key (Long) = split_key (Segment)
merged = long_df.merge(
    seg,
    how="left",
    on="split_key"
)

# 7) Speichern
merged.to_csv(OUT_FILE, index=False)

print("Fertig! Datei gespeichert unter:")
print(OUT_FILE)

# 8) Neue Spalten anzeigen
new_cols = [c for c in merged.columns if c not in long_df.columns]
print("Neu hinzugefügte Spalten:", new_cols)

# 9) Kurzcheck: wie viele Zeilen haben Elevation-Daten?
print("Zeilen mit nicht-null elev_gain_m:", merged["elev_gain_m"].notna().sum())

# Optional: check ein paar Beispiele
print("\nBeispiel-Mapping (split_key + elev_gain_m) für erste 10 Zeilen mit Werten:")
print(merged.loc[merged["elev_gain_m"].notna(), ["year", "split_key", "elev_gain_m", "avg_grade_pct"]].head(10))
