import { useRef, useState, useCallback } from "react";
import type { DropZone } from "../../utils/layoutTree";

interface DropZoneOverlayProps {
  targetPaneId: string;
  onMoveDrop: (draggedPaneId: string, zone: DropZone) => void;
  onDragLeave: () => void;
}

function getZoneFromPosition(
  x: number,
  y: number,
  width: number,
  height: number
): DropZone {
  const relX = x / width;
  const relY = y / height;

  // Center zone: inner 40%
  if (relX > 0.3 && relX < 0.7 && relY > 0.3 && relY < 0.7) return "center";

  // Closest edge
  const distLeft = relX;
  const distRight = 1 - relX;
  const distTop = relY;
  const distBottom = 1 - relY;
  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min === distLeft) return "left";
  if (min === distRight) return "right";
  if (min === distTop) return "top";
  return "bottom";
}

export function DropZoneOverlay({ targetPaneId, onMoveDrop, onDragLeave }: DropZoneOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeZone, setActiveZone] = useState<DropZone | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const zone = getZoneFromPosition(
        e.clientX - rect.left,
        e.clientY - rect.top,
        rect.width,
        rect.height
      );
      setActiveZone(zone);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedPaneId = e.dataTransfer.getData("text/pane-id");
      if (draggedPaneId && draggedPaneId !== targetPaneId && activeZone) {
        onMoveDrop(draggedPaneId, activeZone);
      }
      setActiveZone(null);
    },
    [activeZone, targetPaneId, onMoveDrop]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (ref.current && !ref.current.contains(e.relatedTarget as Node)) {
        setActiveZone(null);
        onDragLeave();
      }
    },
    [onDragLeave]
  );

  return (
    <div
      ref={ref}
      className="drop-zone-overlay"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {activeZone && (
        <div className="drop-zone-highlight" data-zone={activeZone}>
          {activeZone === "center" && <span className="drop-zone-swap-icon">&#8644;</span>}
        </div>
      )}
    </div>
  );
}
