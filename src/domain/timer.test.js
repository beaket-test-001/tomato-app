import { describe, expect, it } from 'vitest';
import { formatTime, modeDuration, nextMode, presets, recommendFocusMinutes, sanitizeDurations } from './timer';

describe('timer domain', () => {
  it('calculates durations and formats time', () => { expect(modeDuration('focus', presets[0])).toBe(1500); expect(formatTime(65)).toBe('01:05'); });
  it('selects the fourth-cycle long break', () => { expect(nextMode('focus', 4)).toBe('longBreak'); expect(nextMode('focus', 3)).toBe('shortBreak'); });
  it('recommends a shorter focus block from recent feedback', () => { expect(recommendFocusMinutes([{ preset: 'starter', rating: 'tooLong' }, { preset: 'starter', rating: 'justRight' }, { preset: 'starter', rating: 'tooLong' }], presets[0])).toBe(20); });
  it('sanitizes persisted session durations', () => { expect(sanitizeDurations({ focus: 0, shortBreak: '8', longBreak: 61 })).toEqual({ focus: 25, shortBreak: 8, longBreak: 15 }); });
});
