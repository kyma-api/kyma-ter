import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { TerminalPane } from "../Terminal/Terminal";
import type { LayoutNode, DropZone } from "../../utils/layoutTree";
import type { Pane } from "../../store/ui";

interface LayoutContainerProps {
  node: LayoutNode;
  panes: Record<string, Pane>;
  focusedPaneId: string | null;
  singlePane: boolean;
  onClosePane: (paneId: string) => void;
  onMovePane: (sourcePaneId: string, targetPaneId: string, zone: DropZone) => void;
  onFocusPane: (paneId: string) => void;
}

export function LayoutContainer({ node, panes, focusedPaneId, singlePane, onClosePane, onMovePane, onFocusPane }: LayoutContainerProps) {
  if (node.type === "leaf") {
    const pane = node.paneId ? panes[node.paneId] : undefined;
    if (!pane) return null;
    return (
      <TerminalPane
        sessionId={pane.sessionId}
        agentKey={pane.agentKey}
        paneId={pane.id}
        focused={focusedPaneId === pane.id}
        singlePane={singlePane}
        onClose={() => onClosePane(pane.id)}
        onMoveDrop={(draggedPaneId, zone) => onMovePane(draggedPaneId, pane.id, zone)}
        onFocus={() => onFocusPane(pane.id)}
      />
    );
  }

  // Container: render PanelGroup with children
  const children = node.children ?? [];
  const orientation = node.direction === "vertical" ? "vertical" : "horizontal";

  const elements: React.ReactNode[] = [];
  for (let i = 0; i < children.length; i++) {
    if (i > 0) {
      elements.push(
        <PanelResizeHandle
          key={`resize-${node.id}-${i}`}
          className={orientation === "horizontal" ? "resize-handle" : "resize-handle-h"}
        />
      );
    }
    const defaultSize = node.sizes?.[i] ?? (100 / children.length);
    elements.push(
      <Panel key={children[i].id} minSize={10} defaultSize={defaultSize}>
        <LayoutContainer
          node={children[i]}
          panes={panes}
          focusedPaneId={focusedPaneId}
          singlePane={singlePane}
          onClosePane={onClosePane}
          onMovePane={onMovePane}
          onFocusPane={onFocusPane}
        />
      </Panel>
    );
  }

  return (
    <PanelGroup orientation={orientation}>
      {elements}
    </PanelGroup>
  );
}
