import { Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardProvider } from "@/state/DashboardContext";
import { OverviewPage } from "@/pages/OverviewPage";
import { MigrationPage } from "@/pages/MigrationPage";

export function App() {
  return (
    <DashboardProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route
            path="/pacing-course"
            element={
              <MigrationPage
                title="Pacing & Course"
                description="The React port will preserve the existing course, weather and pacing charts next. The Plotly-based chart layer and shared data hooks are already in place."
              />
            }
          />
          <Route
            path="/model-predictions"
            element={
              <MigrationPage
                title="Model Predictions"
                description="The model probability and accuracy charts will be ported with the same Plotly semantics after the shared filter and chart adapters are extracted."
              />
            }
          />
          <Route
            path="/tools"
            element={
              <MigrationPage
                title="Tools"
                description="The empirical pace planner and catch-up estimator are queued for migration after the overview analytics and shared computation layer are stabilized."
              />
            }
          />
        </Routes>
      </AppShell>
    </DashboardProvider>
  );
}
