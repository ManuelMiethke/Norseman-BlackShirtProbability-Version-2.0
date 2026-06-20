import { ParticipantsSection } from "@/components/overview/ParticipantsSection";
import { TimeRelationsSection } from "@/components/overview/TimeRelationsSection";
import { useDashboard } from "@/state/DashboardContext";
import { StateBlock } from "@/components/common/StateBlock";

export function OverviewPage() {
  const { error } = useDashboard();

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Overview Route</span>
          <h1>React migration foundation</h1>
          <p>
            This first route establishes the new React shell, shared dataset loading, filter state and Plotly integration. It is intentionally parallel to the Streamlit app so the existing dashboard remains available while the frontend is rebuilt.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 1</strong>
          <span>Overview analytics port</span>
        </div>
      </section>

      {error ? (
        <StateBlock
          title="Dataset load failed"
          description={error}
          tone="error"
        />
      ) : null}

      <ParticipantsSection />
      <TimeRelationsSection />
    </div>
  );
}
