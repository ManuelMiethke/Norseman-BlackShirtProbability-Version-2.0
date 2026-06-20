# Norseman Bachelor – Data Repository

This repository contains all **data processing, cleaning, and preparation steps**
used for the Norseman Bachelor thesis project.  
It serves as the **data backbone** for the Streamlit dashboard contained in the
corresponding Dashboard Code.

This repository represents the author’s first data project of this scale.
It is far from being a production-ready data pipeline, but is an exploratory research codebase.

The structure evolved organically over time. Data sources were added step by step, assumptions were revised, and different approaches were tested. Legacy files and intermediate scripts were intentionally kept to maintain traceability and to avoid removing potentially relevant material.


---

## Project Purpose

The goal of this repository is to:
- collect raw race and athlete data
- clean and standardize heterogeneous data sources
- derive structured datasets for analysis and visualization
- export reproducible artifacts for the dashboard layer

This separation ensures **clean architecture** and reproducibility between
data engineering and presentation.

---

## Requirements
- pandas
- numpy
- matplotlib
- seaborn
- scipy
- jupyter
- pyyaml
- tqdm

---

This repository **does not contain any UI logic**.

---

## Reproducibility Notes

- Scripts are not designed to be re-runnable #Sessions Key for the scraping change over time
- Some notebooks contain exploratory work and are **not part of the final process**

---

## Known Limitations

- Legacy files remain for traceability/ backup
- Not all experiments were fully cleaned up

---