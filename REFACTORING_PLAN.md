# Refactoring Plan

## Status

- `completed` P0.1 Central app configuration and race metadata
- `completed` P0.2 Validated shared data layer for dashboard runtime assets
- `completed` P0.3 Introduce a race-year registry schema
- `completed` P0.5 Add a real shared Streamlit design system baseline
- `completed` P0.4 Remove redundant loaders and repeated preprocessing on render path
- `completed` P0.6 Document current new-year workflow
- `completed` P0.7 Add tests for configuration and data-contract validation
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

## Next P0 Focus

- Continue P0.4 by moving more modules off duplicated loader/filter logic.
- Begin P1.1 by extracting shared filter and grouping utilities from the larger modules.
- Begin P1.2 by splitting oversized modules into data, metrics and render responsibilities.
- Begin P1.11/P1.12 by formalizing environment and dependency setup.

## Deferred but Intentionally Preserved

- Existing dashboard content and analytics stay in place unless a change clearly improves maintainability or correctness.
- Raw data and exploratory thesis-era scripts remain non-destructively preserved during the first refactoring wave.
- No large architecture rewrite or dependency expansion is planned in the first pass.
