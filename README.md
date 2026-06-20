# Norseman Dashboard Redesign

This repository contains a Streamlit-based Norseman/Triathlon dashboard and the thesis-era data preparation code it currently depends on.

The current redesign goal is pragmatic:

- keep the working dashboard usable
- remove the most fragile runtime assumptions first
- make future race years safer to integrate
- improve UI consistency without a risky rewrite

The repository now also contains a parallel React migration in `frontend/` so the product can move away from Streamlit without throwing away the current working analytics.

## Repository layout

```text
Norseman_Bachelor_Dashboard_only Kopie 2/
  dashboard/
    assets/          # packaged runtime data + styling + logos
    core/            # shared config, data access, validation
    modules/         # page-level analytical modules
    pages/           # Streamlit multipage entry files

Norseman_Bachelor_Data Kopie/
  ...                # legacy data prep, validation and research scripts

docs/
  ADDING_RACE_YEAR.md
  REACT_MIGRATION.md

scripts/
  validate_dashboard_assets.py

tests/
  test_dashboard_config.py
  test_dashboard_data.py
```

## Quick start

The repository does not yet include a final dependency manifest. The current working environment needs at least:

- `python3`
- `streamlit`
- `pandas`
- `numpy`
- `plotly`

### Validate packaged dashboard assets

```bash
python3 scripts/validate_dashboard_assets.py
```

### Run automated checks

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

### Start the dashboard

```bash
python3 -m streamlit run 'Norseman_Bachelor_Dashboard_only Kopie 2/dashboard/main.py'
```

### Start the React migration app

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

The main migrated route is available at `http://127.0.0.1:5173/overview`.

## Current architecture decisions

### 1. Shared configuration first, not a rewrite

The dashboard now has a central configuration layer in `dashboard/core/config.py`.

This is the source of truth for:

- asset paths
- app metadata
- year/group options
- race-year metadata and cutoff context

Reason:

- the previous code scattered years, paths and race assumptions across multiple modules
- centralizing metadata is the lowest-risk step toward future multi-year and multi-race support

### 2. Keep `data_store.py` as a compatibility adapter

The old module import surface is still preserved through `dashboard/data_store.py`, but it now delegates to `dashboard/core/data.py`.

Reason:

- existing modules keep working
- new code can use the cleaner shared layer
- migration can proceed incrementally instead of forcing a full-file rewrite

### 3. Validate packaged assets explicitly

`dashboard/core/validators.py` and `scripts/validate_dashboard_assets.py` check that:

- required runtime assets exist
- packaged years match across long, wide and model datasets
- race-year registry entries are internally consistent
- course profile ordering remains valid

Reason:

- adding a new year should fail fast on schema/config mistakes instead of breaking the UI later

### 4. Improve UI through a shared baseline, not per-widget hacks

`dashboard/assets/styles.css` is now the shared styling layer for:

- page shell
- sidebar navigation
- filter cards
- chart containers
- footer and status states

Reason:

- `layout.py` already expected a style file, but none existed
- a real CSS baseline raises product quality quickly without rewriting every module

### 5. Migrate from Streamlit to React in parallel

The new React workspace is documented in [docs/REACT_MIGRATION.md](docs/REACT_MIGRATION.md).

The migration deliberately starts as a parallel frontend:

- Streamlit remains the safe baseline
- React becomes the new presentation layer
- Plotly remains the charting language so diagrams keep the same analytical look
- the React overview route now covers participation KPIs, distance-vs-time donuts and the cross-year median comparison

Reason:

- the user-facing product goal now prioritizes a fresher, more flexible frontend
- replacing charts and frontend architecture at the same time would add unnecessary risk

## Data and year integration

Use [docs/ADDING_RACE_YEAR.md](docs/ADDING_RACE_YEAR.md) as the current reference workflow.

In short:

1. preserve raw inputs non-destructively
2. add metadata to `RACE_YEAR_REGISTRY`
3. prepare/update packaged assets
4. run the validator
5. smoke-test all dashboard pages

## Current validation status

As of this redesign iteration:

- dashboard asset validation passes
- unit tests for config/data contracts pass
- the four main Streamlit pages instantiate successfully via `streamlit.testing.v1.AppTest`
- the React app builds successfully after the expanded overview migration slice

## Open points

- Several legacy data-preparation scripts still contain thesis-era absolute paths and are not fully parameterized.
- The repository still lacks a final dependency manifest.
- Many analytical modules still mix business logic and rendering in large files.
- Group and cutoff logic is improved centrally but not yet fully deduplicated across every module.
- The React frontend currently covers the first three overview analytics blocks; the remaining overview modules and the other pages are still queued for porting.
- The new React app still reads packaged static assets directly; a slimmer frontend-oriented data contract is a next step.

## Related project files

- Refactoring plan: [REFACTORING_PLAN.md](REFACTORING_PLAN.md)
- Redesign changelog: [CHANGELOG_REDESIGN.md](CHANGELOG_REDESIGN.md)
