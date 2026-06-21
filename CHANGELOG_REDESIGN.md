# Changelog Redesign

## 2026-06-21

### Added

- Added `frontend/src/lib/pacingDistributions.ts` to port the original `pacetabelle.py` pacing-distribution logic to React.
- Added `frontend/src/components/pacing/PaceDistributionSection.tsx` for the third real `Pacing & Course` migration slice.
- Added `frontend/src/lib/pacingHeatmap.ts` to port the original `heatmap.py` pacing heatmap logic to React.
- Added `frontend/src/components/pacing/PacingHeatmapSection.tsx` for the final `Pacing & Course` migration slice.
- Added `frontend/src/hooks/useModelData.ts` to load the packaged model-evaluation CSV per route/module in React.
- Added `frontend/src/lib/modelAccuracy.ts` to port the original `modelaccuracy.py` chart logic to React.
- Added `frontend/src/components/predictions/ModelAccuracySection.tsx` and `frontend/src/pages/ModelPredictionsPage.tsx` for the first real `Model Predictions` migration slice.
- Added `frontend/src/lib/blackShirtProbability.ts` to port the original grouped probability plot from `blackshirt_prob.py` to React.
- Added `frontend/src/components/predictions/BlackShirtProbabilitySection.tsx` for the second and final `Model Predictions` slice.

### Verified

- Verified the React app still builds successfully after adding the pace-distribution slice.
- Verified `python3 scripts/validate_dashboard_assets.py` still passes after the new wide-data contract extension.
- Verified `python3 -m unittest discover -s tests -p 'test_*.py'` still passes after the new pacing-distribution slice.
- Verified the React dev server starts locally on `http://127.0.0.1:5173/` outside the sandbox after port-binding approval.
- Verified the migrated `http://127.0.0.1:5173/pacing-course` route loads in the in-app browser and renders without browser console warnings/errors after the new section was added.
- Verified the React app still builds successfully after adding the pacing heatmap and completing the route.
- Verified `python3 scripts/validate_dashboard_assets.py` still passes after the long-data contract extension for `segment_time_s`.
- Verified `python3 -m unittest discover -s tests -p 'test_*.py'` still passes after the pacing heatmap slice.
- Verified the reloaded `http://127.0.0.1:5173/pacing-course` route renders the new `Pacing Heatmap` section without console warnings/errors in the in-app browser.
- Verified the React app still builds successfully after adding the first `Model Predictions` slice.
- Verified `python3 scripts/validate_dashboard_assets.py` still passes after introducing the React model-data hook.
- Verified `python3 -m unittest discover -s tests -p 'test_*.py'` still passes after the model-accuracy slice.
- Verified `http://127.0.0.1:5173/model-predictions` loads in the in-app browser and renders the new accuracy section without console warnings/errors.
- Verified the React app still builds successfully after adding the grouped probability section and completing the route.
- Verified `python3 scripts/validate_dashboard_assets.py` still passes after the full `Model Predictions` route migration.
- Verified `python3 -m unittest discover -s tests -p 'test_*.py'` still passes after the probability slice.
- Verified the reloaded `http://127.0.0.1:5173/model-predictions` route renders both prediction sections without browser console warnings/errors.

### Changed

- Extended the React wide-data contract with `t1_time`, `t2_time` and `zombie_hill_time` so the pacing route can consume the original leg-wise timing summaries directly.
- Expanded the React `Pacing & Course` route with the original pace-distribution boxplots, preserved stats semantics and a retained Zombie-Hill toggle.
- Extended the React long-data contract with `segment_time_s` so the pacing route can reuse the original split-delta semantics from Streamlit.
- Expanded the React `Pacing & Course` route with the original pacing heatmap and completed the route end to end in React.
- Replaced the React `Model Predictions` placeholder with a real page and ported the original model-accuracy chart with preserved test-set filtering and course-profile overlay semantics.
- Expanded the React `Model Predictions` route with the original grouped Black-Shirt probability plot and completed the route end to end in React.

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
- Added `docs/REACT_MIGRATION.md` to define the new React-first frontend direction.
- Added root `README.md` with startup, architecture summary and open points.
- Added automated tests for dashboard config and data contracts under `tests/`.
- Added a new `frontend/` React + Vite workspace with routed pages, shared filters and Plotly support.
- Added `frontend/src/lib/groups.ts` to centralize React-side year and finisher-group filtering.
- Added `frontend/src/lib/yearComparison.ts` to port the original cross-year median comparison and finish-trend logic.
- Added `frontend/src/components/overview/YearComparisonSection.tsx` for the new React overview comparison block.
- Added `frontend/src/hooks/useLongData.ts` so long split data can be loaded per route/module instead of being forced into global dashboard state.
- Added `frontend/src/lib/whoAreWeRacing.ts` to port the original long-data outcome/frontier calculations.
- Added `frontend/src/components/overview/WhoAreWeRacingSection.tsx` for the first long-data-driven React overview section.
- Added `frontend/src/lib/rankProgression.ts` to port the Top-10 and all-athlete rank progression logic from the Streamlit overview.
- Added `frontend/src/components/overview/RankProgressionSection.tsx` to render the combined React rank progression section.
- Added `frontend/src/lib/histograms.ts` to port the overview time-distribution logic with absolute, relative and bike-scale modes.
- Added `frontend/src/components/overview/HistogramsSection.tsx` for the React time-distribution block.
- Added `frontend/src/hooks/useCourseProfileData.ts` to load the packaged course profile CSV in the React app.
- Added `frontend/src/lib/courseWeatherSpeed.ts` to port the combined course profile, weather and segment-speed logic from `weatherspeed.py`.
- Added `frontend/src/components/pacing/CourseWeatherSpeedSection.tsx` and `frontend/src/pages/PacingCoursePage.tsx` for the first real `Pacing & Course` migration slice.
- Added `frontend/src/lib/pacingAccumulated.ts` to port the accumulated race-progress logic from `accumulated.py`.
- Added `frontend/src/components/pacing/AccumulatedProgressSection.tsx` for the second real `Pacing & Course` slice.

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
- Verified the React app builds successfully with `npm run build`.
- Verified the React app renders locally on `http://127.0.0.1:5173/overview`.
- Verified the expanded React app still builds successfully with `npm run build` after the year-comparison migration slice.
- Verified dashboard asset validation still passes after the React-side data-contract extension.
- Verified Python tests still pass after the new React-side helper layer was added.
- Verified the React app still builds successfully after introducing the route-local long-data hook and `Who Are We Racing?`.
- Verified Python tests still pass after the new long-data React slice was added.
- Verified the React app still builds successfully after adding the rank progression slice.
- Verified Python tests still pass after the rank progression slice was added.
- Verified the React app still builds successfully after adding the histogram slice.
- Verified dashboard asset validation still passes after the histogram slice was added.
- Verified Python tests still pass after the histogram slice was added.
- Verified the React app still builds successfully after replacing the `Pacing & Course` placeholder with the first real page slice.
- Verified dashboard asset validation still passes after the first `Pacing & Course` slice.
- Verified Python tests still pass after the first `Pacing & Course` slice.
- Verified the React app still builds successfully after adding the accumulated-progress slice to `Pacing & Course`.
- Verified dashboard asset validation still passes after the accumulated-progress slice.
- Verified Python tests still pass after the accumulated-progress slice.

### Notes

- The workspace does not currently expose a dependency manifest at repository root.
- Local visual inspection of the rendered Streamlit UI was only partially available; code-level analysis was used as the primary baseline.

### Changed

- Replaced fragile runtime path handling in the dashboard with shared config-driven asset resolution.
- Converted the year filter to dynamic year discovery from the packaged long dataset instead of hardcoded year options.
- Reworked header/footer/layout to use centralized metadata and relative asset references.
- Removed the runtime absolute CSV path in `modules/timerelations.py` and delegated it to the shared data layer.
- Delegated the remaining module-level CSV loading helpers in `modelaccuracy.py` and `weatherspeed.py` to the shared data layer.
- Introduced a parallel React frontend instead of extending Streamlit further for the new UI direction.
- Ported the first overview route to React while preserving Plotly-based diagram behavior for `Distance vs. Time Relations`.
- Expanded the React overview route with the original year-comparison analytics and a matching median split reference table.
- Extended the React wide-row data contract with run-start and cutoff split fields needed for cross-year comparisons.
- Hardened React time parsing so malformed segment strings now fail closed instead of producing silent `NaN` math.
- Reused shared React filter helpers in the time-relations layer to reduce duplicated year/finish-group logic.
- Extended the React frontend with a dedicated long-data loading path instead of reusing the wide-data dashboard context for every module.
- Expanded the React overview route with the original `Who Are We Racing?` outcome stack and empirical frontier summary.
- Expanded the React overview route with a combined rank progression section covering the original Top-10 and all-athlete cut-off views.
- Expanded the React overview route with the original overview histogram block and completed the React coverage of the original Overview page.
- Replaced the React `Pacing & Course` placeholder with a real page and ported the original combined `Course, Weather & Speed` chart.
- Expanded the React `Pacing & Course` page with the original accumulated race-progress chart.

### Fixed

- Eliminated the broken runtime logo path pattern that previously depended on the launch directory.
- Eliminated direct module-level runtime CSV reads in the dashboard layer.

### Notes

- The React build currently emits a large bundle warning because Plotly is heavy; bundle/data chunking remains a follow-up optimization.
- An in-app browser smoke test against `http://127.0.0.1:5173/overview` was attempted after this slice, but the browser tab crashed before a reliable visual confirmation; build and test checks remain green.
