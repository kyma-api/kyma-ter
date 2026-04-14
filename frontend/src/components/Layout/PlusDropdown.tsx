import { useEffect, useRef } from "react";

interface PlusDropdownProps {
  open: boolean;
  onClose: () => void;
  onNewTerminal: () => void;
  onNewAgent: () => void;
}

export function PlusDropdown({ open, onClose, onNewTerminal, onNewAgent }: PlusDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="plus-dropdown">
      <button
        className="plus-dropdown-item"
        onClick={() => { onNewTerminal(); onClose(); }}
      >
        <span className="plus-dropdown-icon">&#9654;</span>
        New Terminal
      </button>
      <button
        className="plus-dropdown-item"
        onClick={() => { onNewAgent(); onClose(); }}
      >
        <span className="plus-dropdown-dot" style={{ backgroundColor: "#eab308" }} />
        Kyma Agent
      </button>
    </div>
  );
}
