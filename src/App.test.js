import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from './App.vue';

describe('App', () => {
  it('renders the tomato garden heading', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          focusTarget: 4,
          garden: [],
          tips: [],
        }),
      })
    );

    const wrapper = mount(App);

    expect(wrapper.text()).toContain('Tomato garden mode');
    expect(wrapper.text()).toContain('Grow your focus');
  });
});
