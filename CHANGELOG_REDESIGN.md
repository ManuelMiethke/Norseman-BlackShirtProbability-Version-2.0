# Changelog Redesign

## 2026-06-20

### Added

- Started systematic redesign/refactoring track for the Norseman dashboard repository.
- Added `REFACTORING_PLAN.md` with repository analysis, prioritized tasks, risks, dependencies and acceptance criteria.
- Added this redesign changelog for incremental documentation.
- Added `dashboard/core/config.py` with shared asset paths, app metadata and a structured race-year registry.
- Added `dashboard/core/data.py` with validated cached loaders for the packaged dashboard assets.
- Added `dashboard/core/validators.py` for runtime-asset and registry validation.
- Added `dashboard/assets/styles.css` as the first real design-system baseline for the Streamlit UI.
- Added `scripts/validate_dashboard_assets.py` as a repeatable validation entrypoint.
- Added `docs/ADDING_RACE_YEAR.md` to document the current safe workflow for integrating a new year.
- Added root `README.md` with startup, architecture summary and open points.
- Added automated tests for dashboard config and data contracts under `tests/`.

### Verified

- Confirmed current repository split between dashboard runtime code and thesis-era data/preparation scripts.
- Confirmed packaged dashboard assets currently consist of long, wide, model and course-profile CSV files.
- Verified baseline Streamlit startup locally with `python3 -m streamlit run 'Norseman_Bachelor_Dashboard_only Kopie 2/dashboard/main.py' --server.headless true --server.port 8505`.
- Verified the refactored dashboard pages via `streamlit.testing.v1.AppTest` for:
  - `01_Overview.py`
  - `02_Pacing_&_Course.py`
  - `03_Model Predictions.py`
  - `04_Tools.py`
- Verified post-refactor Streamlit startup again after the new config/data/UI layer was introduced.
- Verified `python3 scripts/validate_dashboard_assets.py` passes.
- Verified `python3 -m unittest discover -s tests -p 'test_*.py'` passes.

### Notes

- The workspace does not currently expose a dependency manifest at repository root.
- Local visual inspection of the rendered Streamlit UI was only partially available; code-level analysis was used as the primary baseline.

### Changed

- Replaced fragile runtime path handling in the dashboard with shared config-driven asset resolution.
- Converted the year filter to dynamic year discovery from the packaged long dataset instead of hardcoded year options.
- Reworked header/footer/layout to use centralized metadata and relative asset references.
- Removed the runtime absolute CSV path in `modules/timerelations.py` and delegated it to the shared data layer.
- Delegated the remaining module-level CSV loading helpers in `modelaccuracy.py` and `weatherspeed.py` to the shared data layer.

### Fixed

- Eliminated the broken runtime logo path pattern that previously depended on the launch directory.
- Eliminated direct module-level runtime CSV reads in the dashboard layer.
