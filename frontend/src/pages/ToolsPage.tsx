import { CatchupSection } from "@/components/tools/CatchupSection";
import { EmpiricalPaceSection } from "@/components/tools/EmpiricalPaceSection";

export function ToolsPage() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-grid dashboard-grid--two">
        <CatchupSection />
        <EmpiricalPaceSection />
      </div>
    </div>
  );
}
