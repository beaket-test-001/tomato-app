import { mount } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBrowserStorage } from '../adapters/browser-storage';
import { useTomatoGarden } from './use-tomato-garden';

describe('useTomatoGarden', () => {
  beforeEach(() => localStorage.clear());
  it('coordinates task creation and persistence', async () => {
    let model;
    const Harness = defineComponent({ setup() { model = reactive(useTomatoGarden({ storage: createBrowserStorage(), notifications: { permission: () => 'unsupported', requestPermission: async () => 'unsupported', playSound() {}, show() {} }, now: () => 1 })); return () => null; } });
    const wrapper = mount(Harness); model.taskInput = 'Refactor app'; model.addTask();
    expect(model.activeTask.text).toBe('Refactor app'); expect(JSON.parse(localStorage.getItem('tomato-garden-tasks'))).toHaveLength(1); wrapper.unmount();
  });
});
