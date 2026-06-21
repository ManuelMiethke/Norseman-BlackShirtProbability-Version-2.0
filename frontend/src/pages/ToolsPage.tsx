import { SectionCard } from "@/components/common/SectionCard";
import { StateBlock } from "@/components/common/StateBlock";
import { CatchupSection } from "@/components/tools/CatchupSection";
import { EmpiricalPaceSection } from "@/components/tools/EmpiricalPaceSection";

export function ToolsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <span className="page-hero__eyebrow">Tools</span>
          <h1>React tools migration</h1>
          <p>
            This route now includes both original Streamlit tools in React: the
            catch-up estimator and the full empirical pacing planner with its detailed
            course/speed figure.
          </p>
        </div>
        <div className="page-hero__badge">
          <strong>Phase 4</strong>
          <span>Tools route complete</span>
        </div>
      </section>

      <CatchupSection />
      <EmpiricalPaceSection />

      <SectionCard
        title="Tools Route Status"
        description="The original Streamlit `Tools` route is now covered end to end in React. Remaining work shifts back to shared architecture, data-contract and maintainability tasks."
      >
        <div className="section-stack">
          <StateBlock
            title="Route complete"
            description="Both `catchup.py` and `empirical_pace.py` are now available in React. The next steps are no longer route gaps but cross-cutting cleanup: shared filter helpers, slimmer frontend-facing assets and further module decomposition."
          />
        </div>
      </SectionCard>
    </div>
  );
}
