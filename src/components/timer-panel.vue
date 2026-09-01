<script setup>
defineProps({ model: { type: Object, required: true } });
</script>

<template>
  <article class="panel timer-panel">
    <div class="mode-switch"><button v-for="mode in model.modes" :key="mode.key" :class="['mode-btn', { active: model.currentMode === mode.key }]" :aria-pressed="model.currentMode === mode.key" :disabled="!model.canSwitchMode" @click="model.pickMode(mode.key)">{{ mode.label }}</button></div>
    <section v-if="model.currentMode === 'focus'" class="session-setup" aria-labelledby="session-task-heading">
      <div class="step-heading"><span>1</span><div><h2 id="session-task-heading">What will you focus on?</h2><p>Choose one concrete outcome for this session.</p></div></div>
      <div class="task-input-row"><label class="sr-only" for="new-task">Task for this focus session</label><input id="new-task" v-model="model.taskInput" @keyup.enter="model.addTask" placeholder="e.g. Draft the project introduction" /><button :disabled="!model.taskInput.trim()" @click="model.addTask">Add and select</button></div>
      <p v-if="model.activeTask" class="active-task"><span>Current task</span><strong>{{ model.activeTask.text }}</strong></p><p v-else class="setup-hint">Add a task above before starting the timer.</p>
    </section>
    <div v-if="model.currentMode === 'focus'" class="step-heading rhythm-heading"><span>2</span><div><h2>Choose a focus rhythm</h2><p>You can adjust this for the kind of work you are doing.</p></div></div>
    <div v-if="model.currentMode === 'focus'" class="preset-picker" aria-label="Focus duration presets"><button v-for="preset in model.presets" :key="preset.key" :class="['preset-card', { active: !model.customFocusMinutes && model.selectedPresetKey === preset.key }]" :aria-pressed="!model.customFocusMinutes && model.selectedPresetKey === preset.key" :disabled="model.running" @click="model.pickPreset(preset.key)"><strong>{{ preset.label }}</strong><span>{{ preset.focusMinutes }} + {{ preset.breakMinutes }} min</span><small>{{ preset.fit }}</small></button></div>
    <div class="ring" :style="{ '--progress': `${model.renderProgress() * 100}%` }"><div class="ring-inner"><p class="mode-name">{{ model.formatModeLabel(model.currentMode) }}</p><h2>{{ model.timeLabel }}</h2><p class="status">{{ model.statusLabel }}</p></div></div>
    <div class="controls"><button class="primary" :disabled="!model.canStart" @click="model.startTimer">{{ model.currentMode === 'focus' && model.activeTask ? `${model.atModeStart ? 'Start' : 'Resume'} ${model.effectiveFocusMinutes} min · ${model.activeTask.text}` : `${model.atModeStart ? 'Start' : 'Resume'} ${model.formatModeLabel(model.currentMode).toLowerCase()}` }}</button><button class="secondary" :disabled="!model.running" @click="model.pauseTimer">Pause</button><button v-if="model.currentMode === 'focus'" class="ghost" :disabled="!model.running && model.atModeStart" @click="model.cancelSession">Cancel session</button><button v-else class="ghost" @click="model.skipBreak">Skip break</button></div>
    <button class="sound-toggle" type="button" @click="model.toggleSound">Sound: {{ model.soundEnabled ? 'On' : 'Off' }}</button>
    <p class="cycle-progress" role="status">{{ model.cycleProgressLabel }}</p>
    <div v-if="model.awaitingFeedback" class="feedback-box"><strong>How did that focus block feel?</strong><div class="feedback-actions"><button @click="model.rateSession('tooShort')">Too short</button><button @click="model.rateSession('justRight')">Just right</button><button @click="model.rateSession('tooLong')">Too long</button></div><button v-if="model.activeTask" class="complete-task" @click="model.toggleTask(model.activeTask)">Mark “{{ model.activeTask.text }}” done</button></div>
    <div v-if="model.recommendation" class="recommendation"><p>Based on your last 3 sessions, try {{ model.recommendation }} minutes next time.</p><button @click="model.applyRecommendation">Use {{ model.recommendation }} minutes</button></div>
  </article>
</template>
