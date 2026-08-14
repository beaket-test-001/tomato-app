import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { createBrowserStorage, storageKeys as keys } from '../adapters/browser-storage';
import { createNotifications } from '../adapters/notifications';
import { clampDailyTarget, dateKey, gardenStage, recentDateKeys } from '../domain/progress';
import { defaultDurations, formatModeLabel, formatTime, modes, nextMode, presets, recommendFocusMinutes, sanitizeDurations, validDuration } from '../domain/timer';

const TIMER_VERSION = 1;

export function useTomatoGarden({ storage = createBrowserStorage(), notifications = createNotifications(), now = () => Date.now() } = {}) {
  const readDailyHistory = () => {
    const stored = storage.readJson(keys.dailyHistory);
    if (stored?.version === 1 && stored.days && typeof stored.days === 'object' && !Array.isArray(stored.days)) {
      return Object.fromEntries(Object.entries(stored.days).filter(([date, count]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(count) && count >= 0));
    }
    const legacy = storage.readJson(keys.dailyProgress);
    return /^\d{4}-\d{2}-\d{2}$/.test(legacy?.date) && Number.isInteger(legacy.count) && legacy.count >= 0 ? { [legacy.date]: legacy.count } : {};
  };
  const createTaskId = () => `${now()}-${Math.random().toString(16).slice(2)}`;
  const tasks = ref(storage.readList(keys.tasks).map((task) => ({ ...task, id: task.id || createTaskId() })));
  const storedActiveTaskId = storage.get(keys.activeTask);
  const activeTaskId = ref(tasks.value.some((task) => task.id === storedActiveTaskId && !task.done) ? storedActiveTaskId : tasks.value.find((task) => !task.done)?.id || null);
  const currentMode = ref('focus');
  const selectedPresetKey = ref(storage.get(keys.preset, 'starter'));
  const selectedPreset = computed(() => presets.find((preset) => preset.key === selectedPresetKey.value) || presets[0]);
  const customFocusMinutes = ref(Number(storage.get(keys.customMinutes)) || null);
  const savedDurations = storage.readJson(keys.sessionDurations);
  const sessionDurations = ref(savedDurations === null ? {
    focus: validDuration(customFocusMinutes.value, 'focus') ? customFocusMinutes.value : selectedPreset.value.focusMinutes,
    shortBreak: selectedPreset.value.breakMinutes,
    longBreak: selectedPreset.value.longBreakMinutes,
  } : sanitizeDurations(savedDurations));
  const effectiveFocusMinutes = computed(() => sessionDurations.value.focus);
  const duration = (mode) => sessionDurations.value[mode] ? sessionDurations.value[mode] * 60 : undefined;
  const secondsLeft = ref(duration('focus'));
  const running = ref(false);
  const dailyHistory = ref(readDailyHistory());
  const today = () => dateKey(new Date(now()));
  const legacyProgress = storage.readJson(keys.dailyProgress);
  const completedPomodoros = ref(dailyHistory.value[today()] ?? (legacyProgress?.date === today() && Number.isInteger(legacyProgress.count) ? legacyProgress.count : 0));
  const soundEnabled = ref(storage.get(keys.sound) !== 'false');
  const notificationPermission = ref(notifications.permission());
  const dailyTarget = ref(clampDailyTarget(storage.get(keys.dailyTarget)));
  const taskInput = ref('');
  const feedback = ref(storage.readList(keys.feedback));
  const sessionHistory = ref(storage.readList(keys.sessionHistory).filter((item) => item.date === today()));
  const awaitingFeedback = ref(false), evidenceOpen = ref(false), settingsOpen = ref(false);
  const editingTaskId = ref(null), editTaskInput = ref(''), removedTask = ref(null);
  let timer = null;

  const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) || null);
  const atModeStart = computed(() => secondsLeft.value === duration(currentMode.value));
  const canStart = computed(() => !running.value && (currentMode.value !== 'focus' || Boolean(activeTask.value)));
  const canSwitchMode = computed(() => !running.value && atModeStart.value);
  const dailyProgress = computed(() => Math.min(completedPomodoros.value, dailyTarget.value));
  const cycleFocusCount = computed(() => completedPomodoros.value % 4);
  const remainingFocusSessions = computed(() => 4 - cycleFocusCount.value);
  const cycleProgressLabel = computed(() => `Long break cycle: ${cycleFocusCount.value} of 4 focus sessions. ${remainingFocusSessions.value} more focus ${remainingFocusSessions.value === 1 ? 'session' : 'sessions'} until a long break.`);
  const recentDailyHistory = computed(() => recentDateKeys(7, new Date(now())).map((date) => ({ date, count: dailyHistory.value[date] || 0, label: date.slice(5) })));
  const currentGardenStage = computed(() => gardenStage(dailyProgress.value, dailyTarget.value));
  const recommendation = computed(() => recommendFocusMinutes(feedback.value, selectedPreset.value));
  const timeLabel = computed(() => formatTime(secondsLeft.value));
  const statusLabel = computed(() => {
    if (running.value) return currentMode.value === 'focus' && activeTask.value ? `Focusing on ${activeTask.value.text}` : `${formatModeLabel(currentMode.value)} in progress…`;
    if (!atModeStart.value) return `Paused with ${Math.ceil(secondsLeft.value / 60)} minutes remaining.`;
    if (currentMode.value === 'focus') return activeTask.value ? `Ready to focus on ${activeTask.value.text}` : 'Add a task to begin a focus session.';
    return `Ready for a ${Math.round(duration(currentMode.value) / 60)}-minute break.`;
  });
  const renderProgress = () => 1 - secondsLeft.value / duration(currentMode.value);
  const saveTasks = () => storage.writeJson(keys.tasks, tasks.value);
  const saveTimerState = () => storage.writeJson(keys.timer, { version: TIMER_VERSION, mode: currentMode.value, secondsLeft: secondsLeft.value, running: running.value, savedAt: now() });
  const clearTimer = () => { clearInterval(timer); timer = null; };
  const saveDailyProgress = () => {
    const key = today(); dailyHistory.value = { ...dailyHistory.value, [key]: completedPomodoros.value };
    storage.writeJson(keys.dailyHistory, { version: 1, days: dailyHistory.value });
    storage.writeJson(keys.dailyProgress, { date: key, count: completedPomodoros.value });
  };
  const notify = (mode) => { if (soundEnabled.value) notifications.playSound(); notifications.show(mode); };
  function finishCurrentSession() {
    clearTimer(); running.value = false; const completedMode = currentMode.value;
    if (completedMode === 'focus') {
      const key = today(); completedPomodoros.value = (dailyHistory.value[key] || 0) + 1; saveDailyProgress();
      sessionHistory.value = sessionHistory.value.filter((item) => item.date === key);
      sessionHistory.value.unshift({ date: key, task: activeTask.value?.text || 'Focus session', minutes: effectiveFocusMinutes.value, completedAt: now() });
      sessionHistory.value = sessionHistory.value.slice(0, 20); storage.writeJson(keys.sessionHistory, sessionHistory.value); awaitingFeedback.value = true;
    }
    currentMode.value = nextMode(completedMode, completedPomodoros.value); secondsLeft.value = duration(currentMode.value); saveTimerState(); notify(completedMode);
  }
  function startTimer() { if (timer) return; running.value = true; saveTimerState(); timer = setInterval(() => { secondsLeft.value -= 1; if (secondsLeft.value <= 0) finishCurrentSession(); else saveTimerState(); }, 1000); }
  function pauseTimer() { running.value = false; clearTimer(); saveTimerState(); }
  function resetTimer() { running.value = false; clearTimer(); secondsLeft.value = duration(currentMode.value); saveTimerState(); }
  function pickMode(mode) { currentMode.value = mode; secondsLeft.value = duration(mode); running.value = false; clearTimer(); saveTimerState(); }
  function skipBreak() { if (currentMode.value !== 'focus') pickMode('focus'); }
  function saveSessionDurations() { sessionDurations.value = sanitizeDurations(sessionDurations.value); storage.writeJson(keys.sessionDurations, sessionDurations.value); }
  function restoreStandardDurations() { const wasAtModeStart = atModeStart.value; sessionDurations.value = { ...defaultDurations }; storage.writeJson(keys.sessionDurations, sessionDurations.value); if (!running.value && wasAtModeStart) { secondsLeft.value = duration(currentMode.value); saveTimerState(); } }
  function pickPreset(key) { selectedPresetKey.value = key; customFocusMinutes.value = null; storage.remove(keys.customMinutes); storage.set(keys.preset, key); const preset = presets.find((item) => item.key === key) || presets[0]; sessionDurations.value = { focus: preset.focusMinutes, shortBreak: preset.breakMinutes, longBreak: preset.longBreakMinutes }; storage.writeJson(keys.sessionDurations, sessionDurations.value); awaitingFeedback.value = false; pickMode('focus'); }
  function applyRecommendation() { if (!recommendation.value) return; customFocusMinutes.value = recommendation.value; storage.set(keys.customMinutes, recommendation.value); sessionDurations.value = { ...sessionDurations.value, focus: recommendation.value }; storage.writeJson(keys.sessionDurations, sessionDurations.value); pickMode('focus'); }
  function rateSession(rating) { feedback.value.push({ rating, preset: selectedPresetKey.value, focusMinutes: effectiveFocusMinutes.value, recordedAt: now() }); feedback.value = feedback.value.slice(-30); storage.writeJson(keys.feedback, feedback.value); awaitingFeedback.value = false; }
  function saveDailyTarget() { dailyTarget.value = clampDailyTarget(dailyTarget.value); storage.set(keys.dailyTarget, dailyTarget.value); }
  function toggleSound() { soundEnabled.value = !soundEnabled.value; storage.set(keys.sound, soundEnabled.value); }
  async function enableNotifications() { notificationPermission.value = await notifications.requestPermission(); }
  function restoreTimerState() {
    const saved = storage.readJson(keys.timer, null, { removeInvalid: true }); const max = duration(saved?.mode);
    if (!saved || saved.version !== TIMER_VERSION || !max || !Number.isInteger(saved.secondsLeft) || saved.secondsLeft < 0 || saved.secondsLeft > max || typeof saved.running !== 'boolean' || !Number.isFinite(saved.savedAt)) { storage.remove(keys.timer); return; }
    currentMode.value = saved.mode; secondsLeft.value = saved.secondsLeft; running.value = saved.running;
    if (!running.value) return; const elapsed = Math.max(0, Math.floor((now() - saved.savedAt) / 1000));
    if (elapsed >= secondsLeft.value) finishCurrentSession(); else { secondsLeft.value -= elapsed; startTimer(); }
  }
  function syncActiveTask() { const id = tasks.value.find((item) => !item.done)?.id || null; activeTaskId.value = id; if (id) storage.set(keys.activeTask, id); else storage.remove(keys.activeTask); }
  function addTask() { const text = taskInput.value.trim(); if (!text) return; const task = { id: createTaskId(), text, done: false }; tasks.value.unshift(task); activeTaskId.value = task.id; storage.set(keys.activeTask, task.id); saveTasks(); taskInput.value = ''; }
  function selectTask(task) { if (!task.done) { activeTaskId.value = task.id; storage.set(keys.activeTask, task.id); } }
  function toggleTask(task) { task.done = !task.done; if (task.done && activeTaskId.value === task.id) syncActiveTask(); saveTasks(); }
  function removeTask(task) { const index = tasks.value.findIndex((item) => item.id === task.id); if (index < 0) return; removedTask.value = { task: { ...task }, index }; tasks.value.splice(index, 1); if (activeTaskId.value === task.id) syncActiveTask(); saveTasks(); }
  function undoRemoveTask() { if (!removedTask.value) return; tasks.value.splice(removedTask.value.index, 0, removedTask.value.task); saveTasks(); removedTask.value = null; }
  function beginEditTask(task) { editingTaskId.value = task.id; editTaskInput.value = task.text; }
  function saveTaskEdit(task) { const text = editTaskInput.value.trim(); if (!text) return; task.text = text; editingTaskId.value = null; saveTasks(); }

  onMounted(restoreTimerState); onBeforeUnmount(clearTimer);
  return { modes, presets, currentMode, selectedPresetKey, customFocusMinutes, sessionDurations, effectiveFocusMinutes, secondsLeft, running, completedPomodoros, soundEnabled, notificationPermission, dailyTarget, taskInput, tasks, activeTaskId, sessionHistory, awaitingFeedback, evidenceOpen, settingsOpen, editingTaskId, editTaskInput, removedTask, selectedPreset, activeTask, atModeStart, canStart, canSwitchMode, dailyProgress, cycleProgressLabel, recentDailyHistory, gardenStage: currentGardenStage, recommendation, timeLabel, statusLabel, formatModeLabel, renderProgress, pickPreset, applyRecommendation, saveSessionDurations, restoreStandardDurations, saveDailyTarget, rateSession, enableNotifications, startTimer, pauseTimer, cancelSession: resetTimer, skipBreak, pickMode, toggleSound, addTask, selectTask, toggleTask, removeTask, undoRemoveTask, beginEditTask, saveTaskEdit };
}
