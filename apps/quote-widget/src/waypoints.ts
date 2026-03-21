export function normalizeWaypointsForRoute(raw: string[]): string[] {
  return (Array.isArray(raw) ? raw : [])
    .map((w) => (w ?? '').toString().trim())
    .filter(Boolean)
    .slice(0, 5);
}
