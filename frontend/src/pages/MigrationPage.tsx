import { StateBlock } from "@/components/common/StateBlock";

export function MigrationPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-stack">
      <section className="page-hero page-hero--compact">
        <div>
          <span className="page-hero__eyebrow">Migration Queue</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>

      <StateBlock
        title="Route scaffolded"
        description="The React app routing, filters and shared asset loading are already in place. This page is intentionally left as the next migration target instead of copying Streamlit UI wholesale."
      />
    </div>
  );
}
