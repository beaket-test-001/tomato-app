<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const presets = [
  { key: 'starter', label: 'Starter', focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, fit: 'A balanced place to begin' },
  { key: 'deep', label: 'Deep work', focusMinutes: 50, breakMinutes: 10, longBreakMinutes: 25, fit: 'For immersive, demanding work' },
  { key: 'light', label: 'Light tasks', focusMinutes: 15, breakMinutes: 3, longBreakMinutes: 15, fit: 'For admin or a low-energy start' },
];

const modes = [
  { key: 'focus', label: 'Focus' },
  { key: 'shortBreak', label: 'Short break' },
  { key: 'longBreak', label: 'Long break' },
];

const TIMER_STORAGE_KEY = 'tomato-timer-state';
const TIMER_STORAGE_VERSION = 1;
const SOUND_ENABLED_STORAGE_KEY = 'tomato-notification-sound-enabled';
const PRESET_STORAGE_KEY = 'tomato-focus-preset';
const FEEDBACK_STORAGE_KEY = 'tomato-session-feedback';
const CUSTOM_MINUTES_STORAGE_KEY = 'tomato-custom-focus-minutes';
const DAILY_PROGRESS_STORAGE_KEY = 'tomato-daily-progress';
const DAILY_TARGET_STORAGE_KEY = 'tomato-daily-target';
const ACTIVE_TASK_STORAGE_KEY = 'tomato-active-task';
const SESSION_HISTORY_STORAGE_KEY = 'tomato-session-history';

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createTaskId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readTasks() {
  return readStoredList('tomato-garden-tasks').map((task) => ({ ...task, id: task.id || createTaskId() }));
}

function readDailyCount() {
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_PROGRESS_STORAGE_KEY) || 'null');
    return stored?.date === todayKey() && Number.isInteger(stored.count) ? stored.count : 0;
  } catch {
    return 0;
  }
}

const currentMode = ref('focus');
const selectedPresetKey = ref(localStorage.getItem(PRESET_STORAGE_KEY) || 'starter');
const selectedPreset = computed(() => presets.find((preset) => preset.key === selectedPresetKey.value) || presets[0]);
const customFocusMinutes = ref(Number(localStorage.getItem(CUSTOM_MINUTES_STORAGE_KEY)) || null);
const effectiveFocusMinutes = computed(() => customFocusMinutes.value || selectedPreset.value.focusMinutes);
const secondsLeft = ref(effectiveFocusMinutes.value * 60);
const running = ref(false);
const completedPomodoros = ref(readDailyCount());
const soundEnabled = ref(localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== 'false');
const notificationPermission = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const dailyTarget = ref(Math.min(12, Math.max(1, Number(localStorage.getItem(DAILY_TARGET_STORAGE_KEY)) || 4)));
const taskInput = ref('');
const tasks = ref(readTasks());
const feedback = ref(readStoredList(FEEDBACK_STORAGE_KEY));
const storedActiveTaskId = localStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
const activeTaskId = ref(tasks.value.some((task) => task.id === storedActiveTaskId && !task.done)
  ? storedActiveTaskId
  : tasks.value.find((task) => !task.done)?.id || null);
const sessionHistory = ref(readStoredList(SESSION_HISTORY_STORAGE_KEY).filter((item) => item.date === todayKey()));
const awaitingFeedback = ref(false);
const evidenceOpen = ref(false);
const settingsOpen = ref(false);
const editingTaskId = ref(null);
const editTaskInput = ref('');
const removedTask = ref(null);

let timer = null;

const currentModeConfig = computed(() => modes.find((mode) => mode.key === currentMode.value));
const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) || null);
const atModeStart = computed(() => secondsLeft.value === modeDuration(currentMode.value));
const canStart = computed(() => !running.value && (currentMode.value !== 'focus' || Boolean(activeTask.value)));
const canSwitchMode = computed(() => !running.value && atModeStart.value);
const dailyProgress = computed(() => Math.min(completedPomodoros.value, dailyTarget.value));
const gardenStage = computed(() => {
  const ratio = dailyProgress.value / dailyTarget.value;
  if (ratio >= 1) return { emoji: '🍅', title: 'Harvest ready', copy: 'You reached today’s focus goal.' };
  if (ratio >= 0.75) return { emoji: '🌿', title: 'Almost ripe', copy: 'One more focused push will finish the patch.' };
  if (ratio >= 0.5) return { emoji: '🌱', title: 'Growing steadily', copy: 'Your focused sessions are taking root.' };
  if (ratio > 0) return { emoji: '🌱', title: 'First sprout', copy: 'The garden has started growing.' };
  return { emoji: '🪴', title: 'Ready to plant', copy: 'Complete a focus session to grow today’s garden.' };
});
const statusLabel = computed(() => {
  if (running.value) {
    return currentMode.value === 'focus' && activeTask.value
      ? `Focusing on ${activeTask.value.text}`
      : `${formatModeLabel(currentMode.value)} in progress…`;
  }
  if (!atModeStart.value) return `Paused with ${Math.ceil(secondsLeft.value / 60)} minutes remaining.`;
  if (currentMode.value === 'focus') {
    return activeTask.value ? `Ready to focus on ${activeTask.value.text}` : 'Add a task to begin a focus session.';
  }
  return `Ready for a ${Math.round(modeDuration(currentMode.value) / 60)}-minute break.`;
});

const recommendation = computed(() => {
  const recent = feedback.value.filter((item) => item.preset === selectedPresetKey.value).slice(-3);
  if (recent.length < 3) return null;
  const tooLong = recent.filter((item) => item.rating === 'tooLong').length;
  const tooShort = recent.filter((item) => item.rating === 'tooShort').length;
  if (tooLong >= 2 && selectedPreset.value.focusMinutes > 10) return selectedPreset.value.focusMinutes - 5;
  if (tooShort >= 2 && selectedPreset.value.focusMinutes < 60) return selectedPreset.value.focusMinutes + 5;
  return null;
});

const timeLabel = computed(() => {
  const minutes = String(Math.floor(secondsLeft.value / 60)).padStart(2, '0');
  const seconds = String(secondsLeft.value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

function formatModeLabel(modeKey) {
  return modes.find((mode) => mode.key === modeKey)?.label || 'Focus';
}

function renderProgress() {
  if (!currentModeConfig.value) return 0;
  return 1 - secondsLeft.value / modeDuration(currentMode.value);
}

function saveTasks() {
  localStorage.setItem('tomato-garden-tasks', JSON.stringify(tasks.value));
}

function modeDuration(modeKey) {
  if (modeKey === 'focus') return effectiveFocusMinutes.value * 60;
  if (modeKey === 'shortBreak') return selectedPreset.value.breakMinutes * 60;
  if (modeKey === 'longBreak') return selectedPreset.value.longBreakMinutes * 60;
  return undefined;
}

function pickPreset(presetKey) {
  selectedPresetKey.value = presetKey;
  customFocusMinutes.value = null;
  localStorage.removeItem(CUSTOM_MINUTES_STORAGE_KEY);
  localStorage.setItem(PRESET_STORAGE_KEY, presetKey);
  currentMode.value = 'focus';
  secondsLeft.value = modeDuration('focus');
  running.value = false;
  awaitingFeedback.value = false;
  clearTimer();
  saveTimerState();
}

function applyRecommendation() {
  if (!recommendation.value) return;
  customFocusMinutes.value = recommendation.value;
  localStorage.setItem(CUSTOM_MINUTES_STORAGE_KEY, String(recommendation.value));
  currentMode.value = 'focus';
  secondsLeft.value = modeDuration('focus');
  clearTimer();
  running.value = false;
  saveTimerState();
}

function saveDailyProgress() {
  localStorage.setItem(DAILY_PROGRESS_STORAGE_KEY, JSON.stringify({ date: todayKey(), count: completedPomodoros.value }));
}

function saveDailyTarget() {
  dailyTarget.value = Math.min(12, Math.max(1, Number(dailyTarget.value) || 4));
  localStorage.setItem(DAILY_TARGET_STORAGE_KEY, String(dailyTarget.value));
}

function rateSession(rating) {
  feedback.value.push({ rating, preset: selectedPresetKey.value, focusMinutes: effectiveFocusMinutes.value, recordedAt: Date.now() });
  feedback.value = feedback.value.slice(-30);
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback.value));
  awaitingFeedback.value = false;
}

function saveTimerState() {
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
    version: TIMER_STORAGE_VERSION,
    mode: currentMode.value,
    secondsLeft: secondsLeft.value,
    running: running.value,
    savedAt: Date.now(),
  }));
}

function saveSoundPreference() {
  localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(soundEnabled.value));
}

async function enableNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission === 'denied') return;
  try {
    notificationPermission.value = await Notification.requestPermission();
  } catch {
    notificationPermission.value = Notification.permission;
  }
}

function playCompletionSound() {
  if (!soundEnabled.value) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Audio playback can be blocked by browser autoplay policies.
  }
}

function showCompletionNotification(modeKey) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  const body = modeKey === 'focus'
    ? 'Focus session complete. Time for a break.'
    : 'Break complete. Ready for your next focus session.';
  try {
    new Notification('Tomato garden', { body });
  } catch {
    // Notifications are optional and must never interrupt the timer.
  }
}

function notifySessionCompletion(modeKey) {
  playCompletionSound();
  showCompletionNotification(modeKey);
}

function clearTimer() {
  clearInterval(timer);
  timer = null;
}

function finishCurrentSession() {
  clearTimer();
  running.value = false;
  const completedMode = currentMode.value;
  if (completedMode === 'focus') {
    completedPomodoros.value += 1;
    saveDailyProgress();
    sessionHistory.value.unshift({
      date: todayKey(),
      task: activeTask.value?.text || 'Focus session',
      minutes: effectiveFocusMinutes.value,
      completedAt: Date.now(),
    });
    sessionHistory.value = sessionHistory.value.slice(0, 20);
    localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(sessionHistory.value));
    awaitingFeedback.value = true;
  }
  const nextMode = completedMode === 'focus'
    ? (completedPomodoros.value % 4 === 0 ? 'longBreak' : 'shortBreak')
    : 'focus';
  currentMode.value = nextMode;
  secondsLeft.value = modeDuration(nextMode);
  saveTimerState();
  notifySessionCompletion(completedMode);
}

function startTimer() {
  if (timer) return;
  running.value = true;
  saveTimerState();
  timer = setInterval(() => {
    secondsLeft.value -= 1;
    if (secondsLeft.value <= 0) {
      finishCurrentSession();
      return;
    }
    saveTimerState();
  }, 1000);
}

function cancelSession() {
  resetTimer();
}

function skipBreak() {
  if (currentMode.value === 'focus') return;
  clearTimer();
  running.value = false;
  currentMode.value = 'focus';
  secondsLeft.value = modeDuration('focus');
  saveTimerState();
}

function pauseTimer() {
  running.value = false;
  clearTimer();
  saveTimerState();
}

function resetTimer() {
  running.value = false;
  clearTimer();
  secondsLeft.value = modeDuration(currentMode.value);
  saveTimerState();
}

function pickMode(modeKey) {
  currentMode.value = modeKey;
  secondsLeft.value = modeDuration(modeKey);
  running.value = false;
  clearTimer();
  saveTimerState();
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value;
  saveSoundPreference();
}

function restoreTimerState() {
  let savedState;
  try {
    savedState = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY));
  } catch {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    return;
  }

  const duration = modeDuration(savedState?.mode);
  if (
    !savedState
    || savedState.version !== TIMER_STORAGE_VERSION
    || !duration
    || !Number.isInteger(savedState.secondsLeft)
    || savedState.secondsLeft < 0
    || savedState.secondsLeft > duration
    || typeof savedState.running !== 'boolean'
    || !Number.isFinite(savedState.savedAt)
  ) {
    localStorage.removeItem(TIMER_STORAGE_KEY);
    return;
  }

  currentMode.value = savedState.mode;
  secondsLeft.value = savedState.secondsLeft;
  running.value = savedState.running;

  if (!running.value) return;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedState.savedAt) / 1000));
  if (elapsedSeconds >= secondsLeft.value) {
    finishCurrentSession();
    return;
  }

  secondsLeft.value -= elapsedSeconds;
  startTimer();
}

function addTask() {
  const value = taskInput.value.trim();
  if (!value) return;
  const task = { id: createTaskId(), text: value, done: false };
  tasks.value.unshift(task);
  activeTaskId.value = task.id;
  localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, task.id);
  saveTasks();
  taskInput.value = '';
}

function selectTask(task) {
  if (task.done) return;
  activeTaskId.value = task.id;
  localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, task.id);
}

function toggleTask(task) {
  task.done = !task.done;
  if (task.done && activeTaskId.value === task.id) {
    activeTaskId.value = tasks.value.find((item) => !item.done)?.id || null;
    if (activeTaskId.value) localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, activeTaskId.value);
    else localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
  }
  saveTasks();
}

function removeTask(task) {
  const index = tasks.value.findIndex((item) => item.id === task.id);
  removedTask.value = { task: { ...task }, index };
  tasks.value.splice(index, 1);
  if (activeTaskId.value === task.id) {
    activeTaskId.value = tasks.value.find((item) => !item.done)?.id || null;
    if (activeTaskId.value) localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, activeTaskId.value);
    else localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
  }
  saveTasks();
}

function undoRemoveTask() {
  if (!removedTask.value) return;
  tasks.value.splice(removedTask.value.index, 0, removedTask.value.task);
  saveTasks();
  removedTask.value = null;
}

function beginEditTask(task) {
  editingTaskId.value = task.id;
  editTaskInput.value = task.text;
}

function saveTaskEdit(task) {
  const value = editTaskInput.value.trim();
  if (!value) return;
  task.text = value;
  editingTaskId.value = null;
  saveTasks();
}

onMounted(() => {
  restoreTimerState();
});

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<template>
  <main class="page-shell">
    <section class="hero-card compact-hero">
      <div><p class="eyebrow">Tomato garden mode</p><h1>Grow your focus, one sprint at a time.</h1><p class="intro">Choose one task, focus for a set time, and grow today’s garden.</p></div>
      <div class="hero-pill"><span>Today’s harvests</span><strong>{{ completedPomodoros }}</strong></div>
    </section>

    <section class="content-grid">
      <article class="panel timer-panel">
        <div class="mode-switch">
          <button v-for="mode in modes" :key="mode.key" :class="['mode-btn', { active: currentMode === mode.key }]" :aria-pressed="currentMode === mode.key" :disabled="!canSwitchMode" @click="pickMode(mode.key)">{{ mode.label }}</button>
        </div>

        <section v-if="currentMode === 'focus'" class="session-setup" aria-labelledby="session-task-heading">
          <div class="step-heading"><span>1</span><div><h2 id="session-task-heading">What will you focus on?</h2><p>Choose one concrete outcome for this session.</p></div></div>
          <div class="task-input-row"><label class="sr-only" for="new-task">Task for this focus session</label><input id="new-task" v-model="taskInput" @keyup.enter="addTask" placeholder="e.g. Draft the project introduction" /><button :disabled="!taskInput.trim()" @click="addTask">Add and select</button></div>
          <p v-if="activeTask" class="active-task"><span>Current task</span><strong>{{ activeTask.text }}</strong></p>
          <p v-else class="setup-hint">Add a task above before starting the timer.</p>
        </section>

        <div v-if="currentMode === 'focus'" class="step-heading rhythm-heading"><span>2</span><div><h2>Choose a focus rhythm</h2><p>You can adjust this for the kind of work you are doing.</p></div></div>
        <div v-if="currentMode === 'focus'" class="preset-picker" aria-label="Focus duration presets">
          <button v-for="preset in presets" :key="preset.key" :class="['preset-card', { active: !customFocusMinutes && selectedPresetKey === preset.key }]" :aria-pressed="!customFocusMinutes && selectedPresetKey === preset.key" :disabled="running" @click="pickPreset(preset.key)"><strong>{{ preset.label }}</strong><span>{{ preset.focusMinutes }} + {{ preset.breakMinutes }} min</span><small>{{ preset.fit }}</small></button>
        </div>

        <div class="ring" :style="{ '--progress': `${renderProgress() * 100}%` }"><div class="ring-inner"><p class="mode-name">{{ formatModeLabel(currentMode) }}</p><h2>{{ timeLabel }}</h2><p class="status">{{ statusLabel }}</p></div></div>
        <div class="controls">
          <button class="primary" :disabled="!canStart" @click="startTimer">{{ currentMode === 'focus' && activeTask ? `${atModeStart ? 'Start' : 'Resume'} ${effectiveFocusMinutes} min · ${activeTask.text}` : `${atModeStart ? 'Start' : 'Resume'} ${formatModeLabel(currentMode).toLowerCase()}` }}</button>
          <button class="secondary" :disabled="!running" @click="pauseTimer">Pause</button>
          <button v-if="currentMode === 'focus'" class="ghost" :disabled="!running && atModeStart" @click="cancelSession">Cancel session</button>
          <button v-else class="ghost" @click="skipBreak">Skip break</button>
        </div>
        <button class="sound-toggle" type="button" @click="toggleSound">Sound: {{ soundEnabled ? 'On' : 'Off' }}</button>

        <div v-if="awaitingFeedback" class="feedback-box"><strong>How did that focus block feel?</strong><div class="feedback-actions"><button @click="rateSession('tooShort')">Too short</button><button @click="rateSession('justRight')">Just right</button><button @click="rateSession('tooLong')">Too long</button></div><button v-if="activeTask" class="complete-task" @click="toggleTask(activeTask)">Mark “{{ activeTask.text }}” done</button></div>
        <div v-if="recommendation" class="recommendation"><p>Based on your last 3 sessions, try {{ recommendation }} minutes next time.</p><button @click="applyRecommendation">Use {{ recommendation }} minutes</button></div>
      </article>

      <article class="panel garden-panel">
        <div class="panel-heading"><div><p class="eyebrow">Garden snapshot</p><h3>Today’s tomato patch</h3></div><span class="badge">Daily target: {{ dailyTarget }}</span></div>
        <p class="panel-explainer">Each completed focus session grows today’s garden.</p>
        <div class="daily-progress" :aria-label="`${dailyProgress} of ${dailyTarget} focus sessions completed today`"><span :style="{ width: `${(dailyProgress / dailyTarget) * 100}%` }"></span></div>
        <p class="progress-copy">{{ dailyProgress }} of {{ dailyTarget }} focus sessions completed today</p>
        <div class="garden-stage"><span aria-hidden="true">{{ gardenStage.emoji }}</span><div><strong>{{ gardenStage.title }}</strong><p>{{ gardenStage.copy }}</p></div></div>
        <div v-if="sessionHistory.length" class="history-list"><h4>Today’s harvests</h4><div v-for="item in sessionHistory" :key="item.completedAt" class="history-item"><span>{{ item.task }}</span><small>{{ item.minutes }} min</small></div></div>
      </article>
    </section>

    <section class="content-grid lower-grid"><article class="panel task-panel">
      <div class="panel-heading"><div><p class="eyebrow">Task queue</p><h3>Upcoming tasks</h3></div></div>
      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task-item" :class="{ done: task.done }">
          <form v-if="editingTaskId === task.id" class="task-edit" @submit.prevent="saveTaskEdit(task)"><label class="sr-only" :for="`edit-${task.id}`">Edit task</label><input :id="`edit-${task.id}`" v-model="editTaskInput" /><button :disabled="!editTaskInput.trim()">Save</button><button type="button" @click="editingTaskId = null">Cancel</button></form>
          <span v-else>{{ task.text }}</span>
          <div v-if="editingTaskId !== task.id" class="task-actions"><button v-if="!task.done" :class="{ selected: activeTaskId === task.id }" :aria-pressed="activeTaskId === task.id" @click="selectTask(task)">{{ activeTaskId === task.id ? 'Selected' : 'Focus next' }}</button><button v-if="!task.done" @click="beginEditTask(task)">Edit</button><button @click="toggleTask(task)">{{ task.done ? 'Undo' : 'Done' }}</button><button class="danger" @click="removeTask(task)">Remove</button></div>
        </li>
      </ul>
      <p v-if="tasks.length === 0" class="empty-state">Your task list is empty. Add your first focus task above.</p>
      <div v-if="removedTask" class="undo-bar" role="status">Task removed. <button @click="undoRemoveTask">Undo</button></div>
    </article></section>

    <section class="panel preferences-panel">
      <button class="settings-toggle" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen">Settings & timer details</button>
      <div v-if="settingsOpen" class="settings-content">
        <div class="setting-row"><div><strong>Daily focus target</strong><p>Choose a realistic goal for today.</p></div><input v-model.number="dailyTarget" type="number" min="1" max="12" aria-label="Daily focus target" @change="saveDailyTarget" /></div>
        <div class="setting-row"><div><strong>Desktop notifications</strong><p>Status: {{ notificationPermission }}</p></div><button v-if="notificationPermission === 'default'" @click="enableNotifications">Enable notifications</button><span v-else-if="notificationPermission === 'granted'" class="setting-status">Enabled</span><span v-else class="setting-status">{{ notificationPermission === 'denied' ? 'Blocked in browser' : 'Not supported' }}</span></div>
        <button class="why-toggle" type="button" :aria-expanded="evidenceOpen" @click="evidenceOpen = !evidenceOpen">Why these times?</button>
        <div v-if="evidenceOpen" class="evidence-box"><strong>A research-informed starting point—not a biological limit.</strong><p>There is no universal maximum focus time or mandatory break length. Brief breaks reliably help vigor and fatigue, while performance effects depend on the task and break duration.</p><div class="evidence-links"><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9432722/" target="_blank" rel="noreferrer">Micro-break meta-analysis</a><a href="https://pubmed.ncbi.nlm.nih.gov/21211793/" target="_blank" rel="noreferrer">Sustained-attention experiment</a></div></div>
      </div>
    </section>
    <footer class="storage-note">Tasks, preferences, and session counts are stored only in this browser.</footer>
  </main>
</template>
