<script setup>
import { reactive } from 'vue';
import GardenPanel from './components/garden-panel.vue';
import PreferencesPanel from './components/preferences-panel.vue';
import TaskPanel from './components/task-panel.vue';
import TimerPanel from './components/timer-panel.vue';
import { useTomatoGarden } from './composables/use-tomato-garden';

const garden = reactive(useTomatoGarden());
</script>

<template>
  <main class="page-shell">
    <section class="hero-card compact-hero"><div><p class="eyebrow">Tomato garden mode</p><h1>Grow your focus, one sprint at a time.</h1><p class="intro">Choose one task, focus for a set time, and grow today’s garden.</p></div><div class="hero-pill"><span>Today’s harvests</span><strong>{{ garden.completedPomodoros }}</strong></div></section>
    <section class="content-grid"><TimerPanel :model="garden" /><GardenPanel :model="garden" /></section>
    <section class="content-grid lower-grid"><TaskPanel :model="garden" /></section>
    <PreferencesPanel :model="garden" />
    <footer class="storage-note">Tasks, preferences, and session counts are stored only in this browser.</footer>
  </main>
</template>
