import { describe, expect, it, vi } from 'vitest';
import { createNotifications } from './notifications';

describe('notifications adapter', () => {
  it('requests permission only when called', async () => { const requestPermission = vi.fn().mockResolvedValue('granted'); const adapter = createNotifications({ Notification: { permission: 'default', requestPermission } }); expect(requestPermission).not.toHaveBeenCalled(); expect(await adapter.requestPermission()).toBe('granted'); });
  it('is safe when browser capabilities are unavailable', () => { const adapter = createNotifications({}); expect(adapter.permission()).toBe('unsupported'); expect(() => adapter.playSound()).not.toThrow(); });
});
