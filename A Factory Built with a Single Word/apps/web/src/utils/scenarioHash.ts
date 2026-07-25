import type { ScenarioData } from '@/api/dtos/backend';

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(', ')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}: ${canonical(record[key])}`).join(', ')}}`;
}

/** Matches hashlib.sha256(json.dumps(..., sort_keys=True)) used by the API. */
export async function scenarioContentHash(data: ScenarioData): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(data)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
