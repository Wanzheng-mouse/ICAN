// Legacy mock config — kept as empty stub for import compatibility.
// All modules now call the real backend exclusively.
export type MockModule = string;
export const MOCK_CONFIG: Record<string, boolean> = {};
export function isMockEnabled(_module: MockModule): boolean {
  return false;
}
