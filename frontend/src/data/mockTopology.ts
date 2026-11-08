interface MockLink {
  sourceId: string;
  targetId: string;
}

/** Stable ID ordering for fictional contacts, independent of map geometry and resident profiles. */
function hashId(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Builds a connected mock tree with N−1 edges; these are never real contacts or displayed routes. */
export function mockForwardingLinks(ids: string[]): MockLink[] {
  const ordered = [...new Set(ids)]
    .map((id) => ({ id, hash: hashId(id) }))
    .sort((a, b) => a.hash - b.hash || a.id.localeCompare(b.id));
  return ordered.slice(1).map((resident, offset) => ({
    sourceId: ordered[resident.hash % (offset + 1)].id,
    targetId: resident.id,
  }));
}
