// Pure tree operations for the tiling layout system.
// A LayoutNode is either a container (has children) or a leaf (has paneId).

export interface LayoutNode {
  id: string;
  type: "container" | "leaf";
  direction?: "horizontal" | "vertical"; // container only
  children?: LayoutNode[];               // container only
  sizes?: number[];                      // container only, relative sizes summing to 100
  paneId?: string;                       // leaf only
}

let nodeCounter = 0;

export function nextNodeId(): string {
  return `node-${++nodeCounter}`;
}

export function resetNodeCounter(max: number) {
  if (max > nodeCounter) nodeCounter = max;
}

// Create a single leaf node
export function createLeaf(paneId: string): LayoutNode {
  return { id: nextNodeId(), type: "leaf", paneId };
}

// Split a leaf into a container with the original + a new leaf
export function splitNode(
  tree: LayoutNode,
  targetNodeId: string,
  direction: "horizontal" | "vertical",
  newPaneId: string
): LayoutNode {
  return mapNode(tree, targetNodeId, (node) => {
    const newLeaf = createLeaf(newPaneId);
    return {
      id: nextNodeId(),
      type: "container" as const,
      direction,
      children: [node, newLeaf],
      sizes: [50, 50],
    };
  });
}

// Remove a leaf and collapse the tree if needed
export function removeNode(tree: LayoutNode, targetNodeId: string): LayoutNode | null {
  if (tree.type === "leaf") {
    return tree.id === targetNodeId ? null : tree;
  }

  // Container: recursively remove from children
  const newChildren: LayoutNode[] = [];
  const newSizes: number[] = [];
  for (let i = 0; i < (tree.children?.length ?? 0); i++) {
    const child = tree.children![i];
    const result = removeNode(child, targetNodeId);
    if (result !== null) {
      newChildren.push(result);
      newSizes.push(tree.sizes?.[i] ?? 50);
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0]; // collapse single-child container

  // Rebalance sizes to sum to 100
  const total = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => (s / total) * 100);

  return {
    ...tree,
    children: newChildren,
    sizes: normalizedSizes,
  };
}

// Swap two leaf nodes
export function swapNodes(tree: LayoutNode, idA: string, idB: string): LayoutNode {
  // Find paneIds for both nodes
  let paneA: string | undefined;
  let paneB: string | undefined;
  walkLeaves(tree, (node) => {
    if (node.id === idA) paneA = node.paneId;
    if (node.id === idB) paneB = node.paneId;
  });
  if (!paneA || !paneB) return tree;

  return mapAllNodes(tree, (node) => {
    if (node.type === "leaf" && node.id === idA) return { ...node, paneId: paneB! };
    if (node.type === "leaf" && node.id === idB) return { ...node, paneId: paneA! };
    return node;
  });
}

// Get all leaf paneIds in order
export function getLeafPaneIds(tree: LayoutNode): string[] {
  const ids: string[] = [];
  walkLeaves(tree, (node) => {
    if (node.paneId) ids.push(node.paneId);
  });
  return ids;
}

// Get all leaf node IDs
export function getLeafNodeIds(tree: LayoutNode): string[] {
  const ids: string[] = [];
  walkLeaves(tree, (node) => ids.push(node.id));
  return ids;
}

// Find a leaf by paneId and return its node ID
export function findNodeByPaneId(tree: LayoutNode, paneId: string): string | null {
  let found: string | null = null;
  walkLeaves(tree, (node) => {
    if (node.paneId === paneId) found = node.id;
  });
  return found;
}

// Find adjacent leaf for keyboard navigation (simple: next/prev in flat order)
export function findAdjacentLeaf(
  tree: LayoutNode,
  currentPaneId: string,
  direction: "left" | "right" | "up" | "down"
): string | null {
  const leaves = getLeafPaneIds(tree);
  const idx = leaves.indexOf(currentPaneId);
  if (idx === -1) return leaves[0] ?? null;

  if (direction === "right" || direction === "down") {
    return leaves[(idx + 1) % leaves.length] ?? null;
  } else {
    return leaves[(idx - 1 + leaves.length) % leaves.length] ?? null;
  }
}

// --- Internal helpers ---

function mapNode(
  tree: LayoutNode,
  targetId: string,
  transform: (node: LayoutNode) => LayoutNode
): LayoutNode {
  if (tree.id === targetId) return transform(tree);
  if (tree.type === "container" && tree.children) {
    return {
      ...tree,
      children: tree.children.map((child) => mapNode(child, targetId, transform)),
    };
  }
  return tree;
}

function mapAllNodes(
  tree: LayoutNode,
  transform: (node: LayoutNode) => LayoutNode
): LayoutNode {
  const mapped = transform(tree);
  if (mapped.type === "container" && mapped.children) {
    return {
      ...mapped,
      children: mapped.children.map((child) => mapAllNodes(child, transform)),
    };
  }
  return mapped;
}

function walkLeaves(tree: LayoutNode, fn: (node: LayoutNode) => void) {
  if (tree.type === "leaf") {
    fn(tree);
  } else if (tree.children) {
    tree.children.forEach((child) => walkLeaves(child, fn));
  }
}
