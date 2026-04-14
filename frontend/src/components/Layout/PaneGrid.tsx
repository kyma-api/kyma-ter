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
            <svg width="24" height="23" viewBox="0 0 48 46" fill="none">
              <path fill="#eab308" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            </svg>
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
