import { haversineDistance, walkMinutes } from '@/lib/geo';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(35.6812, 139.7671, 35.6812, 139.7671)).toBe(0);
  });

  it('calculates distance between Shinjuku and Shibuya (~2.5km)', () => {
    const distance = haversineDistance(35.6896, 139.7006, 35.6580, 139.7016);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(4000);
  });

  it('calculates short distance accurately (~800m)', () => {
    // Shinjuku station to ~800m away
    const distance = haversineDistance(35.6896, 139.7006, 35.6960, 139.7006);
    expect(distance).toBeGreaterThan(600);
    expect(distance).toBeLessThan(1000);
  });
});

describe('walkMinutes', () => {
  it('returns 0 for same location', () => {
    expect(walkMinutes(35.6812, 139.7671, 35.6812, 139.7671)).toBe(0);
  });

  it('estimates ~10 minutes for ~800m', () => {
    const minutes = walkMinutes(35.6896, 139.7006, 35.6960, 139.7006);
    expect(minutes).toBeGreaterThanOrEqual(8);
    expect(minutes).toBeLessThanOrEqual(12);
  });

  it('estimates ~30 minutes for Shinjuku to Shibuya', () => {
    const minutes = walkMinutes(35.6896, 139.7006, 35.6580, 139.7016);
    expect(minutes).toBeGreaterThan(25);
    expect(minutes).toBeLessThan(50);
  });
});
