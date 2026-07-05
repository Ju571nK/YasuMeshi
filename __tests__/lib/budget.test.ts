import { budgetToRange } from '@/lib/budget';

describe('budgetToRange', () => {
  it('maps a low bucket to a yen range', () => {
    expect(budgetToRange('B010')).toEqual({ start: 501, end: 1000 });
  });

  it('maps the lowest bucket starting at 0', () => {
    expect(budgetToRange('B009')).toEqual({ start: 0, end: 500 });
  });

  it('maps an open-ended top bucket', () => {
    const r = budgetToRange('B014');
    expect(r?.start).toBe(30001);
    expect(r?.end).toBeGreaterThanOrEqual(30001);
  });

  it('returns null for unknown code', () => {
    expect(budgetToRange('ZZZZ')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(budgetToRange(undefined)).toBeNull();
  });
});
