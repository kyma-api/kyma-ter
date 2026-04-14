import { LayoutContainer } from "./LayoutContainer";
import { getLeafPaneIds } from "../../utils/layoutTree";
import type { DropZone } from "../../utils/layoutTree";
import type { Tab } from "../../store/ui";

interface PaneGridProps {
  tab: Tab;
  focusedPaneId: string | null;
  onClosePane: (paneId: string) => void;
  onMovePane: (sourcePaneId: string, targetPaneId: string, zone: DropZone) => void;
  onFocusPane: (paneId: string) => void;
  onNewTerminal: () => void;
  onNewAgent: () => void;
}

export function PaneGrid({ tab, focusedPaneId, onClosePane, onMovePane, onFocusPane, onNewTerminal, onNewAgent }: PaneGridProps) {
  if (!tab.layout) {
    return (
      <div className="empty-state">
        <pre className="empty-ascii">{` ██╗  ██╗██╗   ██╗███╗   ███╗ █████╗
 ██║ ██╔╝╚██╗ ██╔╝████╗ ████║██╔══██╗
 █████╔╝  ╚████╔╝ ██╔████╔██║███████║
 ██╔═██╗   ╚██╔╝  ██║╚██╔╝██║██╔══██║
 ██║  ██╗   ██║   ██║ ╚═╝ ██║██║  ██║
 ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝`}</pre>
        <div className="empty-actions">
          <button className="empty-action-btn empty-pill-terminal" onClick={onNewTerminal}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>Terminal</span>
          </button>
          <button className="empty-action-btn empty-pill-agent" onClick={onNewAgent}>
            <span className="empty-psi">Ψ</span>
            <span>Kyma Agent</span>
          </button>
        </div>
        <span className="empty-hint-keys">Ctrl+N terminal &middot; Ctrl+A agent workspace</span>
      </div>
    );
  }

  const singlePane = getLeafPaneIds(tab.layout).length <= 1;

  return (
    <LayoutContainer
      node={tab.layout}
      panes={tab.panes}
      focusedPaneId={focusedPaneId}
      singlePane={singlePane}
      onClosePane={onClosePane}
      onMovePane={onMovePane}
      onFocusPane={onFocusPane}
    />
  );
}
