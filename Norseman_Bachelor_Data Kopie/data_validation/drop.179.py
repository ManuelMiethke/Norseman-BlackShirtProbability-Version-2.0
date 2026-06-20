import pandas as pd
from pathlib import Path

# Pfade
csv_path = "/Users/manuelmiethke/Norseman_Bachelor/old_data/old_master_data_excel/nxtri_data_all_years.csv"   # deinen Pfad hier eintragen
output_path = "/Users/manuelmiethke/Norseman_Bachelor/new_data/new_nxtri_data_all_years.csv"

# Datei laden 
df = pd.read_csv(csv_path)
print(f"📁 Datei geladen: {df.shape[0]} Zeilen, {df.shape[1]} Spalten")

# Diese Spalten sollen gelöscht werden 
cols_to_drop = [
    "bike_179km_austbygde_time",
    "bike_179km_austbygde_rank"
]

# Nur löschen, wenn sie existieren 
existing = [c for c in cols_to_drop if c in df.columns]

if existing:
    df = df.drop(columns=existing)
    print(f"🧹 Gelöschte Spalten: {existing}")
else:
    print("ℹ️ Keine der Zielspalten in der Datei gefunden.")

# Neue Datei speichern 
df.to_csv(output_path, index=False)
print(f"✅ Bereinigte Datei gespeichert als: {output_path}")
print(f"📏 Neue Shape: {df.shape[0]} Zeilen, {df.shape[1]} Spalten")
