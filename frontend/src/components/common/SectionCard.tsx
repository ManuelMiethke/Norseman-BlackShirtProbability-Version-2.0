import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  children,
  className,
  headerActions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}) {
  return (
    <section className={className ? `section-card ${className}` : "section-card"}>
      <div className="section-card__header">
        <div className="section-card__copy">
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {headerActions ? <div className="section-card__actions">{headerActions}</div> : null}
      </div>
      {children}
    </section>
  );
}
