/** HotPepper budget master code → yen range. Verify codes against official docs. */
const BUDGET_MAP: Record<string, { start: number; end: number }> = {
  B009: { start: 0, end: 500 },
  B010: { start: 501, end: 1000 },
  B011: { start: 1001, end: 1500 },
  B001: { start: 1501, end: 2000 },
  B002: { start: 2001, end: 3000 },
  B003: { start: 3001, end: 4000 },
  B008: { start: 4001, end: 5000 },
  B004: { start: 5001, end: 7000 },
  B005: { start: 7001, end: 10000 },
  B006: { start: 10001, end: 15000 },
  B012: { start: 15001, end: 20000 },
  B013: { start: 20001, end: 30000 },
  B014: { start: 30001, end: 40000 }, // open-ended; sentinel upper bound
};

export function budgetToRange(
  code: string | undefined
): { start: number; end: number } | null {
  if (!code) return null;
  return BUDGET_MAP[code] ?? null;
}
