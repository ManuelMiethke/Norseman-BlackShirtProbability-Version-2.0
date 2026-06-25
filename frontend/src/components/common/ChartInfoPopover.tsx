import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { ChartInfoSpec } from "@/content/chartInfo";

export function ChartInfoPopover({
  title,
  info,
}: {
  title: string;
  info: ChartInfoSpec;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelStyle(undefined);
      return undefined;
    }

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const viewportPadding = 16;
      const panelGap = 10;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - viewportPadding - panelRect.width);
      const anchoredLeft = triggerRect.right - panelRect.width;
      const left = Math.min(Math.max(anchoredLeft, viewportPadding), maxLeft);

      const preferredTop = triggerRect.bottom + panelGap;
      const topSpace = triggerRect.top - panelGap - panelRect.height;
      const maxTop = window.innerHeight - viewportPadding - panelRect.height;

      let top = preferredTop;
      if (preferredTop > maxTop && topSpace >= viewportPadding) {
        top = topSpace;
      }

      top = Math.min(Math.max(top, viewportPadding), Math.max(viewportPadding, maxTop));

      setPanelStyle({
        left: Math.round(left),
        top: Math.round(top),
        visibility: "visible",
      });
    };

    setPanelStyle({
      left: 0,
      top: 0,
      visibility: "hidden",
    });
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={isOpen ? "chart-info chart-info--open" : "chart-info"}
    >
      <button
        ref={triggerRef}
        type="button"
        className="chart-info__trigger"
        aria-label={`About ${title}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        i
      </button>

      {isOpen ? (
        <div
          id={panelId}
          ref={panelRef}
          className="chart-info__panel"
          role="dialog"
          aria-label={`${title} description`}
          style={panelStyle}
        >
          <div className="chart-info__panel-header">
            <strong>{title}</strong>
            <button
              type="button"
              className="chart-info__close"
              aria-label={`Close ${title} description`}
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="chart-info__content">
            {info.sections.map((section) => (
              <section key={section.heading} className="chart-info__section">
                <h4>{section.heading}</h4>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.bullets?.length ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
