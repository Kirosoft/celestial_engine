import { EmissionEnvelope } from './types';
import { InputBufferStore } from './bufferStore';

export interface InputAccessor {
  latest(port: string): any | undefined;
  all(port: string): EmissionEnvelope[];
  window(port: string, n: number): EmissionEnvelope[];
  since(port: string, ts: number): EmissionEnvelope[];
  reduce<T>(port: string, fn: (acc: T, env: EmissionEnvelope)=>T, seed: T): T;
  ports(): string[];
}

export function createInputAccessor(store: InputBufferStore): InputAccessor {
  return {
    latest: (port: string) => store.getLatest(port)?.value,
    all: (port: string) => store.getAll(port),
    window: (port: string, n: number) => store.window(port, n),
    since: (port: string, ts: number) => store.since(port, ts),
    reduce: (port: string, fn, seed) => store.reduce(port, fn, seed),
    ports: () => store.ports(),
  };
}
