import { describe, it, expect, beforeEach } from 'vitest';
import { writeSettings, readSettings } from '../lib/systemSettingsRepo';
import { seedBaseSchemasIfNeeded } from './helpers/seedBaseSchemas';

// NOTE: This test will focus on repo functions; API route would need a harness or adapter.

import { promises as fs } from 'fs';
import { resolve } from 'path';

describe('SystemSettingsRepo', () => {
  beforeEach(async () => {
    const root = resolve(process.cwd(), '.test-system-settings-'+Math.random().toString(36).slice(2));
    process.env.REPO_ROOT = root;
    await fs.mkdir(root, { recursive: true });
    await seedBaseSchemasIfNeeded();
  });

  it('creates default file and masks apiKey after set', async () => {
    const first = await readSettings();
    // Fresh repo -> empty key or masked empty placeholder
    expect(first.llm.apiKey === '' || first.llm.apiKey === '***').toBeTruthy();
    await writeSettings({ llm: { apiKey: 'SECRET123', baseUrl: 'https://example.test' } as any });
    const masked = await readSettings();
    expect(masked.llm.apiKey).toBe('***');
    const revealed = await readSettings({ reveal: true });
    expect(revealed.llm.apiKey).toBe('SECRET123');
  });

  it('applies defaults and validates timeout', async () => {
    await expect(writeSettings({ llm: { timeoutMs: 500 } } as any)).rejects.toThrow();
  const updated = await writeSettings({ llm: { timeoutMs: 1500 } as any });
    expect(updated.llm.timeoutMs).toBe(1500);
  });
});
