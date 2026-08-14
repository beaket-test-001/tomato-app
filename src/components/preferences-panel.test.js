import { mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import PreferencesPanel from './preferences-panel.vue';

it('opens settings and delegates notification permission', async () => { const enableNotifications = vi.fn(); const model = { settingsOpen: false, evidenceOpen: false, dailyTarget: 4, sessionDurations: { focus: 25, shortBreak: 5, longBreak: 15 }, notificationPermission: 'default', saveDailyTarget: vi.fn(), saveSessionDurations: vi.fn(), restoreStandardDurations: vi.fn(), enableNotifications }; const wrapper = mount(PreferencesPanel, { props: { model } }); await wrapper.find('.settings-toggle').trigger('click'); await wrapper.find('.setting-row button').trigger('click'); expect(enableNotifications).toHaveBeenCalledOnce(); });
