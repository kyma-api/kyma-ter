import { LayoutContainer } from "./LayoutContainer";
import type { Tab } from "../../store/ui";

interface PaneGridProps {
  tab: Tab;
  onClosePane: (paneId: string) => void;
  onSplitPane: (paneId: string, direction: "horizontal" | "vertical") => void;
}

export function PaneGrid({ tab, onClosePane, onSplitPane }: PaneGridProps) {
  if (!tab.layout) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#9638;</div>
        <p>No terminals open</p>
        <p className="empty-hint">Click "+" or press Alt+T to get started</p>
      </div>
    );
  }

  return (
    <LayoutContainer
      node={tab.layout}
      panes={tab.panes}
      onClosePane={onClosePane}
      onSplitPane={onSplitPane}
    />
  );
}
