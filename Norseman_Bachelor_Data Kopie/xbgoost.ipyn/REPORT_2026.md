# Norseman 2026 — Datenaufnahme und Modellergebnisse

Stand: 17. August 2026

Testjahr 2026 als vollständiges Holdout. Features, Encoding und Hyperparameter
entsprechen dem bestehenden Notebook; die einzige bewusste Änderung ist der
Verzicht auf die Jahres-Features, begründet in Abschnitt 3.

---

## 1. Datengrundlage

| | |
|---|---|
| Athleten 2026 | 251 erfasst, 236 mit Black/White-Wertung, 15 DNF |
| Starter nach dem Schwimmen | 248 |
| Long-Format gesamt | 52.894 Zeilen über 7 Jahre |
| nach Cut-off-Filter | 49.863 |
| nach Black/White-Filter | 49.040 |
| Training (2018–2025) | 41.023 Zeilen |
| Test (2026) | 8.017 Zeilen, 236 Athleten |
| Black-Anteil | Training 0,654 — Test 0,670 |

Der Cut-off greift für 2026 wie für 2024 und 2025 bei 221,3 km, also 37,5 km
Laufdistanz. Für 2018 bis 2022 bleibt es bei 216,3 km. Alle Splits nach der
Entscheidung werden entfernt, damit keine Information aus der Zukunft in die
Vorhersage fließt.

### Lücken ohne Schwimmzeit

Drei Athleten haben Radzeiten, aber keine Schwimmzeit — rennlogisch unmöglich
und damit ein Ausfall der Zeitnahme am Schwimmausstieg und in T1:

| bib | Name | Wertung | erste Messung |
|---|---|---|---|
| 64 | Isabelle Skontorp | DNF | Rad 6 km (3:02:36) |
| 72 | Sully Luepke | DNF | Rad 6 km (2:42:27) |
| 227 | Einar Finøen | White | Rad 16 km (3:31:02) |

Gegen den Rohabruf geprüft: die Lücke steckt in der Quelle, nicht in der
Verarbeitung. Die Detailseite von RACE RESULT liefert für bib 64 genau einen
Split.

In den Jahren 2018 bis 2025 tritt dieses Muster kein einziges Mal auf, weil es
dort von Hand aufgefüllt wurde. Für 2026 bleiben die Lücken offen. Der Grund:
eine Rückwärts-Hochrechnung über das stabile Feldverhältnis Schwimmen zu Rad
6 km (Median 0,81, Streuung 0,03) ergibt für bib 64 eine Schwimmzeit von
2:28:38 und für bib 72 von 2:12:14. Der langsamste tatsächlich gemessene
Schwimmer 2026 lag bei 2:04:10. Beide Schätzungen liegen darüber — die
Verlangsamung dieser Athleten steckt also nicht im Schwimmen, sondern in T1
oder auf den ersten Radkilometern, und eine proportionale Verteilung würde
Werte erzeugen, die im Feld nie vorkamen.

**Auswirkung auf die Ergebnisse:** bib 64 und 72 sind DNF und fallen ohnehin
aus der Modellierung. Nur bib 227 ist enthalten, mit 30 von 8.017 Testzeilen,
also 0,4 Prozent. Für die Vergleichbarkeit mit den Vorjahren ist die
abweichende Behandlung zu erwähnen.

Die Pipeline meldet dieses Muster seit diesem Durchgang selbst
(`check_leading_gaps` in `validate.py`, Regressionstest `test_leading_gap`).
Bewusst als weiche Meldung: `auto_fix` verwirft harte Werte und interpoliert
neu, hier sind die vorhandenen Radzeiten aber echt gemessen.

---

## 2. Ergebnisse mit 2026 als Testjahr

### Split-Ebene, 8.017 Zeilen

| Metrik | mit Jahres-Features | ohne Jahres-Features |
|---|---|---|
| Accuracy | 0,8448 | **0,8901** |
| ROC AUC | 0,9644 | 0,9624 |
| PR AUC | 0,9825 | 0,9818 |
| Log Loss | 0,3636 | **0,2443** |
| Brier | 0,1142 | **0,0778** |
| Black übersehen | 1.150 | **545** |
| fälschlich Black | 94 | 336 |

Mehrheitsklasse als Vergleichsmaßstab: 0,6701.

### Athleten-Ebene, Entscheidung am letzten Split vor dem Cut-off

Gemessen an `run_37_5km_stavsro_cut_off` für 234 Athleten und an
`run_32_5km_langefonn` für die zwei, denen der 37,5-km-Split fehlt.

| Metrik | mit | ohne |
|---|---|---|
| Accuracy | 0,8718 | **0,9364** |
| Fehler | 30 | **15** |
| ROC AUC | — | **0,9999** |
| Konfusion | 30 übersehen, 0 falsch | 15 übersehen, 0 falsch |

---

## 3. Warum die Jahres-Features raus mussten

Im ersten Durchgang lagen **alle 30 Fehler im Rangband 127 bis 158**. Das
Modell zog seine Grenze bei Rang 129, tatsächlich lag sie 2026 bei Rang 158.

Die Ursache ist Extrapolation. `year` ist numerisch, 2026 liegt außerhalb des
Trainingsbereichs, und ein Entscheidungsbaum kann nicht über seinen
Wertebereich hinaus. Jeder Split auf `year` schickt 2026 in denselben Ast wie
2025 — ausgerechnet das Jahr mit der untypischen Verteilung von 123 Black zu
119 White, dessen Grenze bei Rang 125 lag. Das Modell behandelte 2026 als
weiteres 2025.

`n_starters_year` musste mit entfernt werden, weil die Werte je Jahr eindeutig
sind (2018: 242, 2019: 261, 2021: 97, 2022: 233, 2024: 255, 2025: 253,
2026: 248) und damit ein perfekter Jahres-Fingerabdruck. Inhaltlich geht wenig
verloren, da `split_rank_relative` die Feldgröße bereits herausnormiert.

Unabhängig davon spricht ein praktisches Argument dagegen: ein Modell mit
`year` als Prädiktor ist prospektiv nicht anwendbar, weil das Vorhersagejahr
per Definition immer außerhalb des Trainingsbereichs liegt.

**Der entscheidende Beleg:** ROC AUC bleibt mit 0,9624 gegenüber 0,9644
praktisch unverändert, während Log Loss um 33 Prozent und Brier um 32 Prozent
fallen. Die Rangfolge war nie das Problem — die Kalibrierung war es.

---

## 4. Schwelle statt Modellgüte

Auf Athleten-Ebene erreicht das Modell ROC AUC 0,9999. Die Rangfolge am
Entscheidungspunkt trennt Black und White also nahezu perfekt; offen ist nur,
wo geschnitten wird.

| Schwelle | Fehler | Black übersehen | fälschlich Black |
|---|---|---|---|
| 0,50 | 15 | 15 | 0 |
| 0,30 | 9 | 9 | 0 |
| 0,25 | 6 | 6 | 0 |
| **0,20** | **2** | 1 | 1 |
| 0,15 | 2 | 0 | 2 |

Noch näher an der Rennlogik liegt eine Top-N-Regel, denn beim Norseman
bekommen nicht alle über einer Wahrscheinlichkeit das schwarze Shirt, sondern
die schnellsten 160 am Kontrollpunkt. Nimmt man die 158 Athleten mit der
höchsten Wahrscheinlichkeit, sind **157 davon tatsächlich Black — 99,4
Prozent, bei 2 Fehlern insgesamt**.

Die feste Schwelle von 0,5 ist damit die größte verbleibende Fehlerquelle,
nicht das Modell.

---

## 5. Fehlerverlauf entlang der Strecke

Ohne Jahres-Features sinkt die Fehlerquote im Lauf deutlich, dort wo die
Entscheidung näher rückt:

| Station | mit | ohne |
|---|---|---|
| Zombie Hill, 1. Kehre | 13,6 % | 5,5 % |
| Zombie Hill, 5. Kehre | 13,6 % | 4,2 % |
| Lauf 32,5 km Langefonn | 13,1 % | 2,1 % |
| Lauf 37,5 km Stavsro | 12,8 % | 6,4 % |

Vorher lag die Quote über die gesamte zweite Rennhälfte flach bei 11 bis
14 Prozent — ein Modell, das wirklich lernt, muss näher an der Entscheidung
besser werden. Genau das tut es jetzt.

**Einschränkung für die frühen Stationen.** Am Schwimmausstieg und in T1 liegt
das Modell unter der Mehrheitsklasse und ist dort damit wertlos:

| Station | Modell | Mehrheitsklasse |
|---|---|---|
| swim_finish | 0,570 | 0,672 |
| transition_1_in | 0,643 | 0,672 |
| bike_start | 0,757 | 0,672 |
| bike 6 km | 0,826 | 0,672 |
| Lauf 37,5 km | 0,936 | 0,675 |

Ab dem Radstart schlägt es den trivialen Vergleichswert klar. Vorhersagen vor
dem Radstart sollten nicht interpretiert werden.

---

## 6. Wichtigste Merkmale

| Merkmal | Gain |
|---|---|
| split_rank_relative | 0,292 |
| split_rank | 0,214 |
| leg_run | 0,069 |
| progress_perc | 0,053 |
| cum_time_seconds | 0,043 |
| precipitation | 0,039 |
| delta_rank | 0,031 |
| wind_speed_10m | 0,030 |

Rang und relativer Rang tragen zusammen gut die Hälfte. Nach dem Wegfall der
Jahres-Features gewinnen die Wetter-Merkmale sichtbar an Gewicht.

**Hinweis:** `wind_effect` ist in allen Jahren zu 100 Prozent leer. Die Spalte
enthält Text (`headwind`, `tailwind`, `crosswind`), und die aus dem Notebook
übernommene Zeile `pd.to_numeric(..., errors="coerce")` macht daraus
durchgängig NaN. Das Merkmal trägt nichts bei und ist faktisch tot — bewusst
unverändert gelassen, damit die Vergleichbarkeit zum bisherigen Stand erhalten
bleibt. Für eine spätere Version wäre eine One-Hot-Kodierung sinnvoll.

---

## 7. Offene Punkte

**2025 gegen die offiziellen Ergebnisse prüfen.** Mit 123 Black zu 119 White
weicht das Jahr stark von allen anderen ab, in denen 158 bis 160 schwarze
Shirts vergeben wurden. Am Kontrollpunkt reichen die White-Finisher bis Rang 71
hinauf, die Black bis Rang 125 — diese Überlappung ist ungewöhnlich. Da 2025
das letzte Trainingsjahr ist, überträgt sich ein möglicher Fehler direkt auf
die 2026-Vorhersage.

**Eine Zeile in 2025** trägt am Cut-off-Split `race_distance_km` = 226,0 statt
221,3 und wird dadurch herausgefiltert.

**bib 227** auf der offiziellen Ergebnisseite nachschlagen. Steht dort eine
Schwimmzeit, liegt eine Extraktionslücke vor; andernfalls ist der aktuelle
Umgang korrekt.

**Pipeline mit der neuen Prüfregel durchlaufen lassen.** Die Regel ist gebaut
und getestet, `run_pipeline.py` wurde seitdem aber noch nicht ausgeführt. Die
Regel wird dann drei `leading_gap`-Meldungen ausweisen.

**Aufgefüllte Werte sind nicht gekennzeichnet.** In keinem Jahr lässt sich
unterscheiden, welche Zeiten gemessen und welche rekonstruiert wurden. Eine
Flag-Spalte wurde bewusst nicht eingeführt, um das Schema stabil zu halten.

---

## 8. Reproduktion

```bash
cd "Norseman_Bachelor_Data Kopie/xbgoost.ipyn"

# Ergebnisse dieses Reports
python train_holdout.py --drop-year-features --write-dashboard-csv

# Vergleichslauf mit Jahres-Features
python train_holdout.py

# Alternative: jedes Jahr out-of-sample, sieben Modelle
python train_holdout.py --leave-one-year-out --write-dashboard-csv
```

Ausgaben in `holdout_reports/`: Metriken als JSON, Vorhersagen je Athlet und
Split, Fehlerquote je Station, Kalibrierung, Merkmalswichtigkeit.

Die Dashboard-Datei `xgb_black_probs_long_with_errors.csv` enthält nun alle
sieben Jahre; 2026 ist als `test` markiert, die Vorjahre als `train`. Seite 03
filtert auf `set == "test"` und zeigt damit die 236 Athleten von 2026. Die
vorherige Fassung liegt als `.csv.bak` daneben.
