# Adding a Race Year

This repository is still in a transition phase between thesis-era scripts and a more production-ready data workflow.

The current goal is not to replace the legacy preparation chain in one step. The goal is to make the existing path explicit, repeatable and safer.

## Current safe workflow

1. Preserve the raw source files for the new year without overwriting old inputs.
2. Add the new year metadata to `Norseman_Bachelor_Dashboard_only Kopie 2/dashboard/core/config.py`.
3. Generate or update the packaged dashboard assets non-destructively.
4. Run the validation script.
5. Smoke-test all Streamlit pages.

## Required metadata

Every new year entry in `RACE_YEAR_REGISTRY` should define:

- `race_id`
- `race_name`
- `location`
- `year`
- `distance_label`
- `cutoff_run_km`
- `cutoff_split_key`
- `finish_distance_km`
- `starters_after_swim`
- `result_source`
- `import_status`
- `notes`

Use the existing 2018-2025 entries as templates.

## Runtime assets that must remain valid

The dashboard currently depends on four packaged files in `dashboard/assets`:

1. `nxtri_data_all_years_long_ready_featured.csv`
2. `nxtri_data_all_years.csv`
3. `xgb_black_probs_long_with_errors.csv`
4. `course_profile.csv`

Do not modify old source data destructively. Create new intermediate files or dated copies when preparing a new year.

## Current legacy preparation chain

The legacy data scripts in `Norseman_Bachelor_Data Kopie` indicate this order:

1. merge long splits with weather
2. merge elevation/grade into the long table
3. derive `wind_effect`
4. derive `split_rank_relative`
5. derive long-format features
6. optionally apply cutoff cleaning for model-related artifacts

The relevant scripts are currently:

- `wetter_daten/mergen_splits_und_wetter.py`
- `new_data/elevation_in_Long.py`
- `new_data/wind_effect.py`
- `new_data/relative_ranks.py`
- `new_data/neue_features.py`
- `xbgoost.ipyn/cut-off.py`

Important limitation:

- Several of these scripts still contain absolute local paths from the original thesis environment.
- Before running them for a new year, update only copies or clearly parameterized versions.
- Do not overwrite existing packaged dashboard assets until validation has passed.

## Validation

Run:

```bash
python3 scripts/validate_dashboard_assets.py
```

This checks:

- all runtime asset files exist
- the race-year registry is internally consistent
- long, wide and model assets expose the same set of years
- packaged years are represented in the registry
- the course profile remains sorted by distance

## Streamlit smoke test

Run:

```bash
python3 -m streamlit run 'Norseman_Bachelor_Dashboard_only Kopie 2/dashboard/main.py'
```

Then verify:

- app starts without asset-path errors
- year filter includes the new year
- overview page renders
- pacing page renders
- model page renders
- tools page renders

## Known gaps

- The full import pipeline is not yet parameterized end-to-end.
- There is not yet a single command that rebuilds every packaged artifact from raw data.
- Future refactoring should move the legacy scripts behind explicit CLI entrypoints and a raw/processed/staged directory contract.
