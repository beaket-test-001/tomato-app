<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const modes = [
  { key: 'focus', label: 'Focus', duration: 25 * 60 },
  { key: 'shortBreak', label: 'Short break', duration: 5 * 60 },
  { key: 'longBreak', label: 'Long break', duration: 15 * 60 },
];

const TIMER_STORAGE_KEY = 'tomato-timer-state';
const TIMER_STORAGE_VERSION = 1;

const currentMode = ref('focus');
const secondsLeft = ref(modes[0].duration);
const running = ref(false);
const completedPomodoros = ref(Number(localStorage.getItem('tomato-pomodoros') || 0));
const plan = ref(null);
const taskInput = ref('');
const tasks = ref(JSON.parse(localStorage.getItem('tomato-garden-tasks') || '[]'));

let timer = null;

const currentModeConfig = computed(() => modes.find((mode) => mode.key === currentMode.value));

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
  return 1 - secondsLeft.value / currentModeConfig.value.duration;
}

function saveTasks() {
  localStorage.setItem('tomato-garden-tasks', JSON.stringify(tasks.value));
}

function modeDuration(modeKey) {
  return modes.find((mode) => mode.key === modeKey)?.duration;
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

function clearTimer() {
  clearInterval(timer);
  timer = null;
}

function finishCurrentSession() {
  clearTimer();
  running.value = false;
  if (currentMode.value === 'focus') {
    completedPomodoros.value += 1;
    localStorage.setItem('tomato-pomodoros', String(completedPomodoros.value));
  }
  const nextMode = currentMode.value === 'focus'
    ? (completedPomodoros.value % 4 === 0 ? 'longBreak' : 'shortBreak')
    : 'focus';
  currentMode.value = nextMode;
  secondsLeft.value = modeDuration(nextMode);
  saveTimerState();
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

function pauseTimer() {
  running.value = false;
  clearTimer();
  saveTimerState();
}

function resetTimer() {
  running.value = false;
  clearTimer();
  secondsLeft.value = currentModeConfig.value.duration;
  saveTimerState();
}

function pickMode(modeKey) {
  currentMode.value = modeKey;
  secondsLeft.value = modeDuration(modeKey);
  running.value = false;
  clearTimer();
  saveTimerState();
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
  tasks.value.unshift({ text: value, done: false });
  saveTasks();
  taskInput.value = '';
}

function toggleTask(index) {
  tasks.value[index].done = !tasks.value[index].done;
  saveTasks();
}

function removeTask(index) {
  tasks.value.splice(index, 1);
  saveTasks();
}

onMounted(async () => {
  restoreTimerState();
  const response = await fetch('/api/plan');
  plan.value = await response.json();
});

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<template>
  <main class="page-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Tomato garden mode</p>
        <h1>Grow your focus, one sprint at a time.</h1>
        <p class="intro">
          This cozy pomodoro companion blends deep work with a little garden energy: plant a task,
          harvest a session, and keep your day blooming.
        </p>
      </div>
      <div class="hero-pill">
        <span>Sessions harvested</span>
        <strong>{{ completedPomodoros }}</strong>
      </div>
    </section>

    <section class="content-grid">
      <article class="panel timer-panel">
        <div class="mode-switch">
          <button
            v-for="mode in modes"
            :key="mode.key"
            :class="['mode-btn', { active: currentMode === mode.key }]"
            @click="pickMode(mode.key)"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="ring" :style="{ '--progress': `${renderProgress() * 100}%` }">
          <div class="ring-inner">
            <p class="mode-name">{{ formatModeLabel(currentMode) }}</p>
            <h2>{{ timeLabel }}</h2>
            <p class="status">{{ running ? 'Growing in progress…' : 'Ready to sow a session.' }}</p>
          </div>
        </div>

        <div class="controls">
          <button class="primary" @click="startTimer">Start</button>
          <button class="secondary" @click="pauseTimer">Pause</button>
          <button class="ghost" @click="resetTimer">Reset</button>
        </div>
      </article>

      <article class="panel garden-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Garden snapshot</p>
            <h3>Today’s tomato patch</h3>
          </div>
          <span v-if="plan" class="badge">{{ plan.focusTarget }} focus sprints</span>
        </div>

        <div v-if="plan" class="garden-list">
          <div v-for="item in plan.garden" :key="item.name" class="garden-item">
            <div>
              <strong>{{ item.name }}</strong>
              <p>{{ item.note }}</p>
            </div>
            <span>{{ item.status }}</span>
          </div>
        </div>

        <div class="tips-list" v-if="plan">
          <div v-for="tip in plan.tips" :key="tip" class="tip-chip">{{ tip }}</div>
        </div>
      </article>
    </section>

    <section class="content-grid lower-grid">
      <article class="panel task-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Task bed</p>
            <h3>Plant the next task</h3>
          </div>
        </div>

        <div class="task-input-row">
          <input v-model="taskInput" @keyup.enter="addTask" placeholder="Add a task for the next sprint" />
          <button @click="addTask">Add</button>
        </div>

        <ul class="task-list">
          <li v-for="(task, index) in tasks" :key="`${task.text}-${index}`" class="task-item" :class="{ done: task.done }">
            <span>{{ task.text }}</span>
            <div class="task-actions">
              <button @click="toggleTask(index)">{{ task.done ? 'Undo' : 'Done' }}</button>
              <button @click="removeTask(index)">Remove</button>
            </div>
          </li>
        </ul>
      </article>
    </section>
  </main>
</template>
