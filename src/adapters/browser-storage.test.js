import { beforeEach, describe, expect, it } from 'vitest';
import { createBrowserStorage } from './browser-storage';

describe('browser storage adapter', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips JSON values', () => { const adapter = createBrowserStorage(); adapter.writeJson('key', { value: 1 }); expect(adapter.readJson('key')).toEqual({ value: 1 }); });
  it('recovers from malformed lists', () => { localStorage.setItem('key', '{'); expect(createBrowserStorage().readList('key')).toEqual([]); expect(localStorage.getItem('key')).toBeNull(); });
});
