"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleGraphPanel({
  title,
  description,
  children,
  nodeCount,
  edgeCount
}: {
  title: string;
  description?: string;
  children: ReactNode;
  nodeCount: number;
  edgeCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="panel graph-collapsible-panel"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="graph-panel-summary">
          <span className="chip">节点 {nodeCount}</span>
          <span className="chip">关系 {edgeCount}</span>
          <span className="graph-panel-toggle" aria-hidden="true" />
        </div>
      </summary>
      {isOpen ? <div className="graph-panel-body">{children}</div> : null}
    </details>
  );
}
