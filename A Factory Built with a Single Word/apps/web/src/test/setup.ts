/**
 * Vitest 全局设置
 */
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
});
