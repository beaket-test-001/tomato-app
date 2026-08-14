export const presets = [
  { key: 'starter', label: 'Starter', focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, fit: 'A balanced place to begin' },
  { key: 'deep', label: 'Deep work', focusMinutes: 50, breakMinutes: 10, longBreakMinutes: 25, fit: 'For immersive, demanding work' },
  { key: 'light', label: 'Light tasks', focusMinutes: 15, breakMinutes: 3, longBreakMinutes: 15, fit: 'For admin or a low-energy start' },
];

export const modes = [
  { key: 'focus', label: 'Focus' },
  { key: 'shortBreak', label: 'Short break' },
  { key: 'longBreak', label: 'Long break' },
];

export const defaultDurations = { focus: 25, shortBreak: 5, longBreak: 15 };

export function validDuration(value, mode) {
  return Number.isInteger(value) && value >= 1 && value <= (mode === 'focus' ? 120 : 60);
}

export function sanitizeDurations(value) {
  if (!value || typeof value !== 'object') return { ...defaultDurations };
  return Object.fromEntries(Object.entries(defaultDurations).map(([mode, fallback]) => [
    mode, validDuration(Number(value[mode]), mode) ? Number(value[mode]) : fallback,
  ]));
}

export function modeDuration(mode, preset, customFocusMinutes = null) {
  if (mode === 'focus') return (customFocusMinutes || preset.focusMinutes) * 60;
  if (mode === 'shortBreak') return preset.breakMinutes * 60;
  if (mode === 'longBreak') return preset.longBreakMinutes * 60;
  return undefined;
}

export function nextMode(completedMode, completedPomodoros) {
  if (completedMode !== 'focus') return 'focus';
  return completedPomodoros % 4 === 0 ? 'longBreak' : 'shortBreak';
}

export function formatModeLabel(modeKey) {
  return modes.find((mode) => mode.key === modeKey)?.label || 'Focus';
}

export function formatTime(secondsLeft) {
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function recommendFocusMinutes(feedback, preset) {
  const recent = feedback.filter((item) => item.preset === preset.key).slice(-3);
  if (recent.length < 3) return null;
  const tooLong = recent.filter((item) => item.rating === 'tooLong').length;
  const tooShort = recent.filter((item) => item.rating === 'tooShort').length;
  if (tooLong >= 2 && preset.focusMinutes > 10) return preset.focusMinutes - 5;
  if (tooShort >= 2 && preset.focusMinutes < 60) return preset.focusMinutes + 5;
  return null;
}
