import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';

async function addFocusTask(wrapper, text = 'Draft the introduction') {
  await wrapper.find('#new-task').setValue(text);
  await wrapper.find('.task-input-row button').trigger('click');
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: vi.fn(() => Promise.resolve('granted')),
      },
    });
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
    localStorage.setItem('tomato-daily-progress', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 3 }));
    const wrapper = mount(App);

    await addFocusTask(wrapper);
    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

    expect(wrapper.find('.mode-name').text()).toBe('Long break');
    expect(wrapper.find('.ring h2').text()).toBe('15:00');
    expect(JSON.parse(localStorage.getItem('tomato-daily-progress')).count).toBe(4);
  });

  it('starts a short break when the focus cycle is not complete', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);

    await addFocusTask(wrapper);
    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

    expect(wrapper.find('.mode-name').text()).toBe('Short break');
    expect(wrapper.find('.ring h2').text()).toBe('05:00');
  });

  it('switches to a research-informed preset without presenting it as a limit', async () => {
    const wrapper = mount(App);
    const deepPreset = wrapper.findAll('.preset-card').find((button) => button.text().includes('Deep work'));

    await deepPreset.trigger('click');

    expect(wrapper.find('.ring h2').text()).toBe('50:00');
    expect(localStorage.getItem('tomato-focus-preset')).toBe('deep');
    await wrapper.find('.settings-toggle').trigger('click');
    await wrapper.find('.why-toggle').trigger('click');
    expect(wrapper.find('.evidence-box').text()).toContain('not a biological limit');
  });

  it('records session feedback and offers a non-binding adjustment', async () => {
    localStorage.setItem('tomato-session-feedback', JSON.stringify([
      { rating: 'tooLong', preset: 'starter' },
      { rating: 'tooLong', preset: 'starter' },
      { rating: 'justRight', preset: 'starter' },
    ]));
    const wrapper = mount(App);

    expect(wrapper.find('.recommendation').text()).toContain('try 20 minutes');
    expect(wrapper.find('.ring h2').text()).toBe('25:00');
    await wrapper.find('.recommendation button').trigger('click');
    expect(wrapper.find('.ring h2').text()).toBe('20:00');
  });

  it('requests notification permission only from the explicit settings control', async () => {
    const wrapper = mount(App);

    expect(Notification.requestPermission).not.toHaveBeenCalled();
    await addFocusTask(wrapper);
    await wrapper.find('.primary').trigger('click');
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    await wrapper.find('.settings-toggle').trigger('click');
    await wrapper.find('.setting-row button').trigger('click');
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('persists the sound preference', async () => {
    const wrapper = mount(App);

    expect(wrapper.find('.sound-toggle').text()).toContain('On');
    await wrapper.find('.sound-toggle').trigger('click');

    expect(wrapper.find('.sound-toggle').text()).toContain('Off');
    expect(localStorage.getItem('tomato-notification-sound-enabled')).toBe('false');
    wrapper.unmount();
  });

  it('saves each custom session duration and applies it after reset', async () => {
    const wrapper = mount(App);
    await wrapper.find('.settings-toggle').trigger('click');
    const inputs = wrapper.findAll('.duration-settings input');

    await inputs[0].setValue(40);
    await inputs[0].trigger('change');
    await inputs[1].setValue(8);
    await inputs[1].trigger('change');
    await inputs[2].setValue(20);
    await inputs[2].trigger('change');

    expect(JSON.parse(localStorage.getItem('tomato-session-durations'))).toEqual({ focus: 40, shortBreak: 8, longBreak: 20 });
    expect(wrapper.find('.ring h2').text()).toBe('25:00');
    await wrapper.find('.ghost').trigger('click');
    expect(wrapper.find('.ring h2').text()).toBe('40:00');
  });

  it('keeps a running session unchanged and uses custom durations for the next mode', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);
    await addFocusTask(wrapper);
    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(1_000);
    await wrapper.find('.settings-toggle').trigger('click');
    const inputs = wrapper.findAll('.duration-settings input');
    await inputs[0].setValue(1);
    await inputs[0].trigger('change');
    await inputs[1].setValue(2);
    await inputs[1].trigger('change');

    expect(wrapper.find('.ring h2').text()).toBe('24:59');
    await vi.advanceTimersByTimeAsync((24 * 60 + 59) * 1000);
    expect(wrapper.find('.mode-name').text()).toBe('Short break');
    expect(wrapper.find('.ring h2').text()).toBe('02:00');
  });

  it('restores safe standard durations from malformed saved values', async () => {
    localStorage.setItem('tomato-session-durations', JSON.stringify({ focus: 0, shortBreak: '5', longBreak: 61 }));
    const wrapper = mount(App);
    await wrapper.find('.settings-toggle').trigger('click');

    expect(wrapper.findAll('.duration-settings input').map((input) => input.element.value)).toEqual(['25', '5', '15']);
    await wrapper.find('.duration-settings button').trigger('click');
    expect(JSON.parse(localStorage.getItem('tomato-session-durations'))).toEqual({ focus: 25, shortBreak: 5, longBreak: 15 });
  });

  it('uses the legacy preset and custom focus value until duration settings are saved', async () => {
    localStorage.setItem('tomato-focus-preset', 'deep');
    localStorage.setItem('tomato-custom-focus-minutes', '45');
    const wrapper = mount(App);

    await wrapper.find('.settings-toggle').trigger('click');
    expect(wrapper.findAll('.duration-settings input').map((input) => input.element.value)).toEqual(['45', '10', '25']);
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
    expect(wrapper.find('.status').text()).toContain('Short break in progress');
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
    expect(wrapper.find('.status').text()).toContain('Paused with 10 minutes');
  });

  it('advances an expired saved focus timer exactly once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T06:30:00Z'));
    localStorage.setItem('tomato-daily-progress', JSON.stringify({ date: '2026-08-13', count: 3 }));
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
    expect(wrapper.find('.status').text()).toContain('Ready for a 15-minute break');
    expect(JSON.parse(localStorage.getItem('tomato-daily-progress')).count).toBe(4);
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

  it('guides the user to add a task before starting focus', async () => {
    const wrapper = mount(App);

    expect(wrapper.find('.primary').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.setup-hint').text()).toContain('Add a task');

    await addFocusTask(wrapper, 'Review the launch copy');

    expect(wrapper.find('.primary').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.primary').text()).toContain('Review the launch copy');
    expect(wrapper.find('.active-task').text()).toContain('Current task');
  });

  it('disables empty task submission and exposes a persistent input label', () => {
    const wrapper = mount(App);
    const input = wrapper.find('#new-task');

    expect(wrapper.find('.task-input-row button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('label[for="new-task"]').exists()).toBe(true);
    expect(input.attributes('placeholder')).toContain('Draft');
  });

  it('prevents mode changes from silently discarding an active session', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);
    await addFocusTask(wrapper);

    await wrapper.find('.primary').trigger('click');

    const modeButtons = wrapper.findAll('.mode-btn');
    expect(modeButtons.every((button) => button.attributes('disabled') !== undefined)).toBe(true);
    expect(modeButtons[0].attributes('aria-pressed')).toBe('true');
  });

  it('resets to the selected preset duration', async () => {
    vi.useFakeTimers();
    const wrapper = mount(App);
    await addFocusTask(wrapper);

    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(2_000);
    await wrapper.find('.ghost').trigger('click');

    expect(wrapper.find('.ring h2').text()).toBe('25:00');
    expect(wrapper.find('.status').text()).toContain('Ready to focus');
  });

  it('renders a garden stage from today’s actual progress', () => {
    localStorage.setItem('tomato-daily-progress', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 2 }));
    const wrapper = mount(App);

    expect(wrapper.find('.garden-stage').text()).toContain('Growing steadily');
    expect(wrapper.find('.progress-copy').text()).toContain('2 of 4');
  });

  it('uses the local calendar day and renders zero-count days in the seven-day history', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12));
    localStorage.setItem('tomato-daily-focus-history', JSON.stringify({
      version: 1,
      days: { '2026-08-10': 2, '2026-08-13': 1 },
    }));

    const wrapper = mount(App);

    expect(wrapper.find('.progress-copy').text()).toContain('1 of 4');
    expect(wrapper.findAll('.week-history li')).toHaveLength(7);
    expect(wrapper.find('.week-history').text()).toContain('08-10');
    expect(wrapper.findAll('.week-history li').map((item) => item.find('strong').text())).toContain('0');
  });

  it('records only completed focus sessions in the daily history and preserves the previous progress key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12));
    const wrapper = mount(App);
    await addFocusTask(wrapper);
    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

    expect(JSON.parse(localStorage.getItem('tomato-daily-focus-history')).days['2026-08-13']).toBe(1);
    expect(JSON.parse(localStorage.getItem('tomato-daily-progress')).count).toBe(1);

    await wrapper.find('.primary').trigger('click');
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(JSON.parse(localStorage.getItem('tomato-daily-focus-history')).days['2026-08-13']).toBe(1);
  });

  it('edits a task and offers undo after removal', async () => {
    const wrapper = mount(App);
    await addFocusTask(wrapper, 'Draft copy');

    await wrapper.findAll('.task-actions button').find((button) => button.text() === 'Edit').trigger('click');
    await wrapper.find('.task-edit input').setValue('Review copy');
    await wrapper.find('.task-edit').trigger('submit');
    expect(wrapper.find('.task-item').text()).toContain('Review copy');

    await wrapper.findAll('.task-actions button').find((button) => button.text() === 'Remove').trigger('click');
    expect(wrapper.find('.undo-bar').text()).toContain('Task removed');
    await wrapper.find('.undo-bar button').trigger('click');
    expect(wrapper.find('.task-item').text()).toContain('Review copy');
  });
});
