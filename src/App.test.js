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

  it('restores an active timer using elapsed wall-clock time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T06:00:10Z'));
    localStorage.setItem('tomato-timer-state', JSON.stringify({
      version: 1,
      mode: 'shortBreak',
      secondsLeft: 300,
      running: true,
      savedAt: new Date('2026-08-13T06:00:00Z').getTime(),
    }));

    const wrapper = mount(App);
    await vi.runAllTicks();

    expect(wrapper.find('.mode-name').text()).toBe('Short break');
    expect(wrapper.find('.ring h2').text()).toBe('04:50');
    expect(wrapper.find('.status').text()).toContain('Growing in progress');
    wrapper.unmount();
  });

  it('keeps a paused timer unchanged after restoration', async () => {
    vi.useFakeTimers();
    localStorage.setItem('tomato-timer-state', JSON.stringify({
      version: 1,
      mode: 'longBreak',
      secondsLeft: 600,
      running: false,
      savedAt: Date.now() - 60_000,
    }));

    const wrapper = mount(App);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(wrapper.find('.mode-name').text()).toBe('Long break');
    expect(wrapper.find('.ring h2').text()).toBe('10:00');
    expect(wrapper.find('.status').text()).toContain('Ready to sow');
  });

  it('advances an expired saved focus timer exactly once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T06:30:00Z'));
    localStorage.setItem('tomato-pomodoros', '3');
    localStorage.setItem('tomato-timer-state', JSON.stringify({
      version: 1,
      mode: 'focus',
      secondsLeft: 60,
      running: true,
      savedAt: new Date('2026-08-13T06:00:00Z').getTime(),
    }));

    const wrapper = mount(App);
    await vi.runAllTicks();

    expect(wrapper.find('.mode-name').text()).toBe('Long break');
    expect(wrapper.find('.ring h2').text()).toBe('15:00');
    expect(wrapper.find('.status').text()).toContain('Ready to sow');
    expect(localStorage.getItem('tomato-pomodoros')).toBe('4');
  });

  it('does not advance a running timer when the clock moved backwards', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T06:00:00Z'));
    localStorage.setItem('tomato-timer-state', JSON.stringify({
      version: 1,
      mode: 'focus',
      secondsLeft: 300,
      running: true,
      savedAt: new Date('2026-08-13T06:01:00Z').getTime(),
    }));

    const wrapper = mount(App);
    await vi.runAllTicks();

    expect(wrapper.find('.ring h2').text()).toBe('05:00');
    wrapper.unmount();
  });

  it('discards malformed saved timer data', async () => {
    localStorage.setItem('tomato-timer-state', JSON.stringify({ mode: 'focus' }));
    const wrapper = mount(App);

    expect(wrapper.find('.mode-name').text()).toBe('Focus');
    expect(wrapper.find('.ring h2').text()).toBe('25:00');
    expect(localStorage.getItem('tomato-timer-state')).toBeNull();
  });
});
