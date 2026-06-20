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
- `Rank Progression` is now also ported as a combined React section for Top-10 finishers and all athletes to the cut-off.
- A shared React-side filter helper layer now covers year and finisher-group filtering for migrated modules.
- A route-local long-data hook now supports long split consumers without pushing that payload into global dashboard context.
- Remaining pages are scaffolded as migration targets.

## Start the React app

From repository root:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Recommended migration order

1. Overview page remaining `histograms`
2. Shared long-data contract for ranking/progression modules
3. Pacing & Course page
4. Model Predictions page
5. Tools page

## Important constraint

The new React frontend currently reads the same packaged static assets used by the Streamlit dashboard. That keeps migration simple, but the next step should be a cleaner frontend-oriented data contract so the browser does not need to parse more data than necessary.
