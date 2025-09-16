import { FileRepo } from './fileRepo';
import { readJson, writeJson } from './fileRepo';
import path from 'path';

const SETTINGS_PATH = 'settings/system.json';
const SCHEMA_PATH = 'schemas/SystemSettings.schema.json';

// Lightweight validator: defer to existing validator module if available later.
async function loadSchema(){
  try {
    return await readJson<any>(SCHEMA_PATH);
  } catch {
    return null; // allow operation even if schema not yet present
  }
}

export interface SystemSettings {
  llm: {
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    timeoutMs: number;
    useStreaming: boolean;
  };
  logging: { level: 'debug'|'info'|'warn'|'error' };
  features: { enableExperimental: boolean };
}

const defaultSettings: SystemSettings = {
  llm: {
    baseUrl: '',
    apiKey: '',
    defaultModel: 'gpt-3.5-turbo',
    timeoutMs: 60000,
    useStreaming: false,
  },
  logging: { level: 'info' },
  features: { enableExperimental: false },
};

async function ensureFile(){
  if(!(await FileRepo.exists(SETTINGS_PATH))){
    await writeJson(SETTINGS_PATH, defaultSettings);
  }
}

export async function readSettings(opts?: { reveal?: boolean }): Promise<SystemSettings & { masked?: boolean }>{
  await ensureFile();
  const data = await readJson<SystemSettings>(SETTINGS_PATH);
  if(!opts?.reveal && data.llm.apiKey){
    return { ...data, llm: { ...data.llm, apiKey: '***' }, masked: true };
  }
  return data;
}

type PartialSettings = Partial<SystemSettings> & { llm?: Partial<SystemSettings['llm']>; logging?: Partial<SystemSettings['logging']>; features?: Partial<SystemSettings['features']> };

export async function writeSettings(patch: PartialSettings){
  await ensureFile();
  const current = await readJson<SystemSettings>(SETTINGS_PATH);
  const merged: SystemSettings = {
    llm: { ...current.llm, ...patch.llm },
    logging: { ...current.logging, ...patch.logging },
    features: { ...current.features, ...patch.features },
  };
  // Basic validation (bounds) – real schema validation can be wired later.
  if(merged.llm.timeoutMs < 1000) throw new Error('timeoutMs must be >= 1000');
  if(!['debug','info','warn','error'].includes(merged.logging.level)) throw new Error('invalid logging.level');
  await writeJson(SETTINGS_PATH, merged);
  return merged;
}

export const SystemSettingsRepo = { readSettings, writeSettings, defaultSettings };
