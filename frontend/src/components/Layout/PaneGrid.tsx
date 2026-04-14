import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { TerminalPane } from "../Terminal/Terminal";
import type { Pane } from "../../store/ui";

interface PaneGridProps {
  panes: Pane[];
  onClosePane: (paneId: string) => void;
}

export function PaneGrid({ panes, onClosePane }: PaneGridProps) {
  if (panes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#9638;</div>
        <p>No terminals open</p>
        <p className="empty-hint">Click "New Terminal" to get started</p>
      </div>
    );
  }

  if (panes.length === 1) {
    const p = panes[0];
    return (
      <TerminalPane
        key={p.id}
        sessionId={p.sessionId}
        agentKey={p.agentKey}
        onClose={() => onClosePane(p.id)}
      />
    );
  }

  // 2+ panes: use resizable panels
  // Layout strategy: 2 panes = horizontal split, 3-4 = 2x2 grid
  if (panes.length <= 2) {
    return (
      <PanelGroup orientation="horizontal">
        {panes.map((p, i) => (
          <Panel key={p.id} minSize={15}>
            {i > 0 && null}
            <TerminalPane
              sessionId={p.sessionId}
              agentKey={p.agentKey}
              onClose={() => onClosePane(p.id)}
            />
          </Panel>
        )).reduce((acc: React.ReactNode[], node, i) => {
          if (i > 0) acc.push(<PanelResizeHandle key={`h-${i}`} className="resize-handle" />);
          acc.push(node);
          return acc;
        }, [])}
      </PanelGroup>
    );
  }

  // 3+ panes: 2-column grid
  const topPanes = panes.slice(0, Math.ceil(panes.length / 2));
  const bottomPanes = panes.slice(Math.ceil(panes.length / 2));

  return (
    <PanelGroup orientation="vertical">
      <Panel minSize={20}>
        <PanelGroup orientation="horizontal">
          {topPanes.map((p, i) => (
            <Panel key={p.id} minSize={15}>
              {i > 0 && null}
              <TerminalPane
                sessionId={p.sessionId}
                agentKey={p.agentKey}
                onClose={() => onClosePane(p.id)}
              />
            </Panel>
          )).reduce((acc: React.ReactNode[], node, i) => {
            if (i > 0) acc.push(<PanelResizeHandle key={`th-${i}`} className="resize-handle" />);
            acc.push(node);
            return acc;
          }, [])}
        </PanelGroup>
      </Panel>
      {bottomPanes.length > 0 && (
        <>
          <PanelResizeHandle className="resize-handle-h" />
          <Panel minSize={20}>
            <PanelGroup orientation="horizontal">
              {bottomPanes.map((p, i) => (
                <Panel key={p.id} minSize={15}>
                  {i > 0 && null}
                  <TerminalPane
                    sessionId={p.sessionId}
                    agentKey={p.agentKey}
                    onClose={() => onClosePane(p.id)}
                  />
                </Panel>
              )).reduce((acc: React.ReactNode[], node, i) => {
                if (i > 0) acc.push(<PanelResizeHandle key={`bh-${i}`} className="resize-handle" />);
                acc.push(node);
                return acc;
              }, [])}
            </PanelGroup>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
