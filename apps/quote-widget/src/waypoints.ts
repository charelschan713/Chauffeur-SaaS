export function parseWaypoints(raw: string): string[] {
  return raw
    .split(/\n|\r|\,/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 5);
}
