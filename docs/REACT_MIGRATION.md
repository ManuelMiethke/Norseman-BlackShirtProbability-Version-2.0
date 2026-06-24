# React Migration

The repository now contains a parallel React frontend in `frontend/`.

## Chosen approach

- Keep the existing Streamlit app intact during migration.
- Build the new frontend as a separate React + Vite workspace.
- Reuse the existing packaged dashboard assets directly through Vite `publicDir`.
- Preserve chart semantics with Plotly in React instead of replacing the visual analysis layer.

## Why this approach

- It avoids breaking the currently working dashboard.
- It keeps the diagrams visually and analytically close to the current product.
- It lets pages be migrated one at a time instead of forcing a risky full rewrite.
- It creates a clearer boundary between data assets and frontend rendering.

## Current status

- React app shell and routing are scaffolded.
- Shared year/group filters are wired.
- The React overview route currently covers:
  - participation KPI cards
  - finish/gender/country summary cards
  - `Distance vs. Time Relations` Plotly donut charts
  - `Year Comparison` with `Time Overview`, `Compared to 2025` and `Trend` modes
- `Who Are We Racing?` is now also ported from the long split dataset.
- `Rank Progression` is now also ported as a combined React section for Top-10 finishers, the 140-180 rank window and all athletes to the cut-off.
- `Time Distributions` is now also ported with the original absolute, relative and bike-scale modes.
- A shared React-side filter helper layer now covers year and finisher-group filtering for migrated modules.
- A route-local long-data hook now supports long split consumers without pushing that payload into global dashboard context.
- The React overview route now covers the original Streamlit Overview page end to end.
- The `Pacing & Course` route now has its first real React slice with the original combined `Course, Weather & Speed` chart.
- The `Pacing & Course` route now also includes the original accumulated race-progress chart.
- The `Pacing & Course` route now also includes the original leg-wise pace-distribution module with its stat tables and Zombie-Hill toggle.
- The `Pacing & Course` route now also includes the original pacing heatmap and therefore covers the full original Streamlit route end to end.
- The `Model Predictions` route now covers the full original Streamlit route end to end, including the timing-station model-accuracy chart, the grouped Black-Shirt probability plot, the frontier-pace section and the probability surface view.
- The `Tools` route now covers the full original Streamlit route end to end, including the catch-up estimator plus the complete empirical pacing planner with its detailed course/speed chart.

## Start the React app

From repository root:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Original module mapping

- `Overview`: `participants`, `timerelations`, `jahres_vergleiche`, `histograms`, `rangverlauf_top10`, `rangverlauf_140_180`, `rangverlauf_gesamt`, `whoareweracing`
- `Pacing & Course`: `weatherspeed`, `accumulated`, `pacetabelle`, `heatmap`
- `Model Predictions`: `modelaccuracy`, `blackshirt_prob`, `frontier_pace`, `probability_3d`
- `Tools`: `empirical_pace`, `catchup`

## Recommended migration order

1. Slimmer frontend-oriented data contract for route-specific assets
2. Consolidate duplicated React-side computation adapters now that all original routes are covered

## Important constraint

The new React frontend currently reads the same packaged static assets used by the Streamlit dashboard. That keeps migration simple, but the next step should be a cleaner frontend-oriented data contract so the browser does not need to parse more data than necessary.
