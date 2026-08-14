import { describe, expect, it } from 'vitest';
import { clampDailyTarget, dateKey, gardenStage, recentDateKeys } from './progress';

describe('progress domain', () => {
  it('uses local calendar dates', () => { const date = new Date(2026, 7, 14, 12); expect(dateKey(date)).toBe('2026-08-14'); expect(recentDateKeys(2, date)).toEqual(['2026-08-13', '2026-08-14']); });
  it('clamps targets and derives the garden stage', () => { expect(clampDailyTarget(99)).toBe(12); expect(gardenStage(2, 4).title).toBe('Growing steadily'); });
});
