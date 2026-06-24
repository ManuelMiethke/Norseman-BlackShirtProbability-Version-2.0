import { Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardProvider } from "@/state/DashboardContext";
import { OverviewPage } from "@/pages/OverviewPage";
import { PacingCoursePage } from "@/pages/PacingCoursePage";
import { ModelPredictionsPage } from "@/pages/ModelPredictionsPage";
import { ToolsPage } from "@/pages/ToolsPage";

export function App() {
  return (
    <DashboardProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/pacing-course" element={<PacingCoursePage />} />
          <Route path="/model-predictions" element={<ModelPredictionsPage />} />
          <Route path="/tools" element={<ToolsPage />} />
        </Routes>
      </AppShell>
    </DashboardProvider>
  );
}
