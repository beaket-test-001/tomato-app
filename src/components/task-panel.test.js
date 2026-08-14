import { mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import TaskPanel from './task-panel.vue';

it('delegates task selection through its interface', async () => { const selectTask = vi.fn(); const task = { id: '1', text: 'Ship refactor', done: false }; const wrapper = mount(TaskPanel, { props: { model: { tasks: [task], editingTaskId: null, editTaskInput: '', activeTaskId: null, removedTask: null, selectTask, beginEditTask: vi.fn(), toggleTask: vi.fn(), removeTask: vi.fn(), saveTaskEdit: vi.fn(), undoRemoveTask: vi.fn() } } }); await wrapper.find('.task-actions button').trigger('click'); expect(selectTask).toHaveBeenCalledWith(task); });
