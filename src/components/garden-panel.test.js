import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import GardenPanel from './garden-panel.vue';

it('renders progress history and sessions', () => { const wrapper = mount(GardenPanel, { props: { model: { dailyTarget: 4, dailyProgress: 2, gardenStage: { emoji: '🌱', title: 'Growing steadily', copy: 'Growing' }, recentDailyHistory: [{ date: '2026-08-14', count: 2, label: '08-14' }], sessionHistory: [{ completedAt: 1, task: 'Write tests', minutes: 25 }] } } }); expect(wrapper.text()).toContain('2 of 4'); expect(wrapper.text()).toContain('Write tests'); });
