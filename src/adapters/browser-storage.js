export const storageKeys = {
  timer: 'tomato-timer-state', sound: 'tomato-notification-sound-enabled', preset: 'tomato-focus-preset',
  feedback: 'tomato-session-feedback', customMinutes: 'tomato-custom-focus-minutes', dailyProgress: 'tomato-daily-progress',
  sessionDurations: 'tomato-session-durations',
  dailyHistory: 'tomato-daily-focus-history', dailyTarget: 'tomato-daily-target', activeTask: 'tomato-active-task',
  sessionHistory: 'tomato-session-history', tasks: 'tomato-garden-tasks',
};

export function createBrowserStorage(storage = localStorage) {
  return {
    get(key, fallback = null) { return storage.getItem(key) ?? fallback; },
    set(key, value) { storage.setItem(key, String(value)); },
    remove(key) { storage.removeItem(key); },
    readJson(key, fallback = null, { removeInvalid = false } = {}) {
      try { return JSON.parse(storage.getItem(key) ?? JSON.stringify(fallback)); }
      catch { if (removeInvalid) storage.removeItem(key); return fallback; }
    },
    writeJson(key, value) { storage.setItem(key, JSON.stringify(value)); },
    readList(key) {
      const value = this.readJson(key, [], { removeInvalid: true });
      return Array.isArray(value) ? value : [];
    },
  };
}
