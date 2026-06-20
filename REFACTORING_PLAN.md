# Refactoring Plan

## Status

- `completed` P0.1 Central app configuration and race metadata
- `completed` P0.2 Validated shared data layer for dashboard runtime assets
- `completed` P0.3 Introduce a race-year registry schema
- `completed` P0.5 Add a real shared Streamlit design system baseline
- `completed` P0.4 Remove redundant loaders and repeated preprocessing on render path
- `completed` P0.6 Document current new-year workflow
- `completed` P0.7 Add tests for configuration and data-contract validation
- `completed` P0.R1 Scaffold parallel React frontend
- `completed` P0.R2 Port the first overview slice to React with Plotly preserved
- `completed` P0.R3 Port the cross-year overview comparison to React
- `completed` P0.R4 Add a route-local long-data hook and port `Who Are We Racing?`
- `in_progress` P1.R3 Port remaining pages to React through shared computation adapters
- `pending` all other tasks unless noted otherwise

## Repository Analysis

### Current structure

- App code lives in `Norseman_Bachelor_Dashboard_only Kopie 2/dashboard`.
- Data-processing and research scripts live in `Norseman_Bachelor_Data Kopie`.
- The dashboard currently reads only packaged CSV assets from `dashboard/assets`.
- There is no dependency manifest or root README for the repository.

### Entry points and page structure

- Streamlit multipage app entrypoint is effectively `dashboard/main.py` plus `dashboard/pages/*`.
- `dashboard/main.py` is empty and the sidebar entry is hidden via CSS.
- Pages are thin composition layers and most logic sits in large `modules/*.py` files.

### Data sources and workflows

- Dashboard runtime files:
  - `assets/nxtri_data_all_years_long_ready_featured.csv`
  - `assets/nxtri_data_all_years.csv`
  - `assets/xgb_black_probs_long_with_errors.csv`
  - `assets/course_profile.csv`
- Data preparation currently depends on multiple standalone scripts with hardcoded local paths.
- Existing preparation chain appears to be:
  1. merge long splits with weather
  2. merge elevation/grade
  3. derive wind effect
  4. add relative ranks
  5. add long-format features
  6. apply cutoff cleaning for model/training use

### Main risks and technical debt

- Absolute filesystem paths in dashboard and pipeline scripts.
- Year, cutoff and group logic duplicated across many modules.
- Repeated CSV loading and duplicated preprocessing in individual modules.
- Missing shared design system despite `layout.py` already expecting `assets/styles.css`.
- Large modules mix data access, transformation, business rules and rendering.
- Legacy folders, `.DS_Store` files and `__pycache__` are committed into the working tree.
- No automated validation of dashboard asset schema or race metadata.

### Baseline checks

- Streamlit app startup verified locally on `2026-06-20` via `python3 -m streamlit run ...`.
- Local browser inspection was partially limited, but the app server starts successfully.

## Priority Definitions

- `P0`: high leverage, low-to-moderate migration risk, foundation for later work
- `P1`: important follow-up refactor or product improvement
- `P2`: useful polish, cleanup or optional extension

## Task List

### Architecture and Project Structure

#### P0.1 Central app configuration and race metadata

- Status: `completed`
- Benefit: removes hardcoded years, groups, asset paths and race constants from page code
- Risk: low
- Dependencies: none
- Acceptance criterion: dashboard pages derive years, groups, assets and race metadata from one shared configuration module; no absolute local paths remain in runtime dashboard code

#### P0.2 Validated shared data layer for dashboard runtime assets

- Status: `completed`
- Benefit: one cached source of truth for long, wide, model and course data; safer schema changes
- Risk: low
- Dependencies: P0.1
- Acceptance criterion: shared loader validates required columns and exposes normalized helper access for all pages; duplicate ad-hoc CSV loaders in key modules are removed or delegated

#### P1.1 Extract shared filter and grouping utilities

- Status: `pending`
- Benefit: eliminates repeated `Top 10` / `Black Shirt` / `White Shirt` / `DNF` logic and year filtering bugs
- Risk: medium
- Dependencies: P0.1, P0.2
- Acceptance criterion: common filter helpers are reused by all major modules and session-state fallbacks are minimized

#### P1.2 Modularize oversized modules into data, metrics and render layers

- Status: `pending`
- Benefit: easier maintenance and testing of `weatherspeed`, `empirical_pace`, `participants`, `histograms` and rank modules
- Risk: medium
- Dependencies: P0.2, P1.1
- Acceptance criterion: at least the largest modules are split into smaller files or internal sections with clear boundaries between transform logic and UI rendering

### Data Model and Data Import

#### P0.3 Introduce a race-year registry schema

- Status: `completed`
- Benefit: new years and later new races can be added through structured metadata instead of scattered constants
- Risk: low
- Dependencies: P0.1
- Acceptance criterion: repository contains a reusable race-year schema with at least race id, name, year, cutoff rule, finish split keys, distance metadata and data-quality notes for all currently bundled years

#### P1.3 Create non-destructive import/validation scaffold for new race data

- Status: `pending`
- Benefit: reduces manual onboarding effort for future race years
- Risk: medium
- Dependencies: P0.3
- Acceptance criterion: repository contains a documented import skeleton with example config, validation entrypoint and expected folder/file contract

#### P1.4 Standardize derived dataset contracts

- Status: `pending`
- Benefit: separates raw, cleaned and dashboard-ready artifacts clearly
- Risk: medium
- Dependencies: P0.2, P0.3
- Acceptance criterion: long, wide, model and course datasets each have documented required columns, datatypes and generation intent

### Performance and Caching

#### P0.4 Remove redundant loaders and repeated preprocessing on render path

- Status: `completed`
- Benefit: faster page loads and less duplicated work
- Risk: low
- Dependencies: P0.2
- Acceptance criterion: key pages reuse cached normalized data rather than re-reading or re-normalizing the same CSV in each module

#### P1.5 Cache derived transformations at the right granularity

- Status: `pending`
- Benefit: improves responsiveness for expensive charts and filtered views
- Risk: medium
- Dependencies: P0.4
- Acceptance criterion: expensive derived tables are cached behind stable inputs and no large per-render DataFrame recomputations remain in the highest-cost modules

#### P2.1 Evaluate faster artifact formats for packaged data

- Status: `pending`
- Benefit: smaller I/O and potentially faster cold starts
- Risk: low
- Dependencies: P1.4
- Acceptance criterion: decision documented whether CSV remains sufficient or Parquet/Feather should be introduced with a clear migration path

### UI/UX and Design System

#### P0.5 Add a real shared Streamlit design system baseline

- Status: `completed`
- Benefit: immediate improvement in perceived product quality and visual consistency
- Risk: low
- Dependencies: P0.1
- Acceptance criterion: repository contains shared CSS/theme tokens for typography, spacing, cards, filters, chart containers, empty states and footer/header styling, and pages visibly use them

#### P1.6 Build reusable page-shell and section-header helpers

- Status: `pending`
- Benefit: less UI duplication and more consistent section behavior
- Risk: low
- Dependencies: P0.5
- Acceptance criterion: pages share reusable helpers for page header, info blocks, chart cards and status messages

#### P1.7 Improve table UX and comparison patterns

- Status: `pending`
- Benefit: better readability and more product-like analysis workflows
- Risk: medium
- Dependencies: P1.6
- Acceptance criterion: major tables have consistent formatting, sorting expectations, comparison cues and empty/error states

### Reusable Components

#### P1.8 Shared chart style helpers and semantic color mapping

- Status: `pending`
- Benefit: consistent charts and easier future extension to other races
- Risk: low
- Dependencies: P0.5
- Acceptance criterion: finish groups, race segments and callout colors are defined centrally and reused across modules

#### P2.2 Reusable KPI card components

- Status: `pending`
- Benefit: easier landing-page and summary redesigns
- Risk: low
- Dependencies: P1.6
- Acceptance criterion: top-level metrics render through reusable helpers instead of hand-built HTML snippets

### Integration of New Races and Years

#### P0.6 Document the current reproducible path for adding a new year

- Status: `completed`
- Benefit: prevents future onboarding from depending on project memory
- Risk: low
- Dependencies: P0.3
- Acceptance criterion: README or dedicated docs describe how to add a new year, validate expected columns and update runtime assets without modifying old data destructively

#### P1.9 Generalize from Norseman-year constants toward race adapters

- Status: `pending`
- Benefit: prepares support for more than one event without rewriting the app
- Risk: medium
- Dependencies: P0.3, P1.8
- Acceptance criterion: race-specific constants are isolated behind metadata/adapters instead of being embedded throughout modules

### Testing, Validation and Documentation

#### P0.7 Add tests for configuration and data-contract validation

- Status: `completed`
- Benefit: protects the new foundation against silent regressions
- Risk: low
- Dependencies: P0.2, P0.3
- Acceptance criterion: automated tests cover config integrity, required columns and a few core transformation helpers

#### P1.10 Add targeted tests for critical calculations

- Status: `pending`
- Benefit: safer refactors of pacing, rank and model-support logic
- Risk: medium
- Dependencies: P0.7
- Acceptance criterion: tests exist for at least split filtering, cutoff handling, group classification and key metric conversions

#### P1.11 Expand repository documentation

- Status: `pending`
- Benefit: faster onboarding and reproducibility
- Risk: low
- Dependencies: P0.6
- Acceptance criterion: repository includes startup instructions, architecture overview, data structure, new year workflow, new race workflow and known limitations

### React Migration

#### P0.R1 Scaffold parallel React frontend

- Status: `completed`
- Benefit: creates a safer path away from Streamlit without breaking the existing app
- Risk: low
- Dependencies: P0.1, P0.2
- Acceptance criterion: repository contains a standalone React workspace with routing, shared layout and working local startup

#### P0.R2 Port the first overview slice to React with Plotly preserved

- Status: `completed`
- Benefit: proves that the frontend can move to React while keeping the existing chart language and race semantics
- Risk: low
- Dependencies: P0.R1
- Acceptance criterion: React overview route renders shared year/group filters, participant summary cards and at least one migrated Plotly chart section

#### P0.R3 Port the cross-year overview comparison to React

- Status: `completed`
- Benefit: extends the React overview route with the original cross-year comparison logic while keeping the packaged-data approach intact
- Risk: low
- Dependencies: P0.R2
- Acceptance criterion: React overview route renders the all-years median split comparison in `Time Overview`, `Compared to 2025` and `Trend` modes using the packaged wide dataset and group-aware filtering

#### P0.R4 Add a route-local long-data hook and port `Who Are We Racing?`

- Status: `completed`
- Benefit: unlocks long-data-based overview migrations without forcing the global dashboard state to parse the long CSV up front
- Risk: low
- Dependencies: P0.R3
- Acceptance criterion: React overview route loads the packaged long split data through a dedicated hook and renders the original `Who Are We Racing?` outcome and frontier views with preserved multi-year semantics

#### P1.R3 Port remaining pages to React through shared computation adapters

- Status: `in_progress`
- Benefit: enables full frontend replacement without rebuilding every analysis module ad hoc
- Risk: medium
- Dependencies: P1.1, P1.2, P0.R4
- Acceptance criterion: remaining dashboard pages are migrated to React using shared data/filter helpers and Plotly-compatible chart adapters, starting with the remaining overview modules (`histograms`, rank progressions)

#### P1.R4 Introduce a frontend-oriented data contract

- Status: `pending`
- Benefit: reduces browser parsing overhead and improves React load performance
- Risk: medium
- Dependencies: P0.R2, P1.4
- Acceptance criterion: React frontend no longer depends on broad CSV parsing for every route and instead consumes slimmer route-oriented assets or an API contract

### Deployment and Configuration

#### P1.12 Add explicit runtime/dependency configuration

- Status: `pending`
- Benefit: reproducible local setup and easier deployment
- Risk: low
- Dependencies: P0.2
- Acceptance criterion: repository contains an explicit dependency manifest and environment/start instructions for the Streamlit app

#### P2.3 Prepare deployment profile and environment separation

- Status: `pending`
- Benefit: easier handoff to cloud or hosted deployment later
- Risk: low
- Dependencies: P1.12
- Acceptance criterion: secrets, environment-specific paths and deployment settings are separated from source code

## Implementation Order

1. P0.1 Central app configuration and race metadata
2. P0.2 Validated shared data layer for dashboard runtime assets
3. P0.3 Race-year registry schema
4. P0.5 Shared design system baseline
5. P0.4 Remove redundant loaders and repeated preprocessing
6. P0.6 Document current new-year workflow
7. P0.7 Tests for config and data-contract validation
8. P0.R1 Scaffold parallel React frontend
9. P0.R2 Port the first overview slice to React
10. P0.R3 Port the cross-year overview comparison to React
11. P0.R4 Add a route-local long-data hook and port `Who Are We Racing?`

## Completed in This Iteration

- Added `dashboard/core/config.py` with centralized asset paths, app metadata and race-year registry.
- Added `dashboard/core/data.py` as a validated cached access layer for long, wide, model and course assets.
- Kept `dashboard/data_store.py` as a backward-compatible adapter to avoid risky broad rewrites.
- Reworked `dashboard/header.py`, `dashboard/footer.py` and `dashboard/layout.py` to consume shared config and dynamic year options.
- Added `dashboard/assets/styles.css` and activated the previously unused style-loading hook.
- Removed the remaining runtime absolute-path dependency from `modules/timerelations.py`.
- Removed the remaining direct `pd.read_csv(...)` calls from dashboard runtime modules by delegating through the shared data layer.
- Added `dashboard/core/validators.py`, `scripts/validate_dashboard_assets.py` and automated tests in `tests/`.
- Added `docs/ADDING_RACE_YEAR.md` and `README.md` to document architecture, startup, validation and open points.
- Added a new `frontend/` React + Vite workspace that reuses the packaged dashboard assets directly.
- Ported the first React overview slice, including participant summary cards and `Distance vs. Time Relations` Plotly donuts.
- Added shared React-side filter helpers so migrated charts do not each re-implement year and finisher-group logic.
- Expanded the React overview route with the original year-comparison chart modes and a supporting median split table.
- Added a route-local React long-data hook so long split parsing is no longer tied to the global wide-data dashboard context.
- Ported `Who Are We Racing?` to React, including the yearly outcome stack and the empirical Black Shirt frontier summary.
- Added `docs/REACT_MIGRATION.md` to document the React-first migration path away from Streamlit.

## Next Focus

- Continue P1.R3 by migrating `histograms` and the remaining rank-progression modules before moving deeper into the other pages.
- Begin P1.1 by extracting shared filter and grouping utilities from the larger modules.
- Begin P1.R4 by preparing slimmer frontend-facing data artifacts for the React app.
- Continue P1.11/P1.12 by formalizing runtime and dependency setup across both frontend tracks.

## Deferred but Intentionally Preserved

- Existing dashboard content and analytics stay in place unless a change clearly improves maintainability or correctness.
- Raw data and exploratory thesis-era scripts remain non-destructively preserved during the first refactoring wave.
- Streamlit stays available as the safety baseline until the React migration covers the remaining routes.
