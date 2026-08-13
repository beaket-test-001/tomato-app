import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          focusTarget: 4,
          garden: [],
          tips: [],
        }),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the tomato garden heading', async () => {
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('Tomato garden mode');
    expect(wrapper.text()).toContain('Grow your focus');
  });

  it('starts a long break after every fourth completed focus session', async () => {
    vi.useFakeTimers();
    localStorage.setItem('tomato-pomodoros', '3');
    const wrapper = mount(App);

    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

    expect(wrapper.find('.mode-name').text()).toBe('Long break');
    expect(wrapper.find('.ring h2').text()).toBe('15:00');
    expect(localStorage.getItem('tomato-pomodoros')).toBe('4');
  });

  it('starts a short break when the focus cycle is not complete', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);

    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

    expect(wrapper.find('.mode-name').text()).toBe('Short break');
    expect(wrapper.find('.ring h2').text()).toBe('05:00');
  });
});
