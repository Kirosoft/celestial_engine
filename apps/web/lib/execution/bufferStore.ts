import { EmissionEnvelope } from './types';

export interface InputBufferStore {
  append(port: string, env: EmissionEnvelope): void;
  getLatest(port: string): EmissionEnvelope | undefined;
  getAll(port: string): EmissionEnvelope[];
  window(port: string, n: number): EmissionEnvelope[];
  since(port: string, ts: number): EmissionEnvelope[];
  reduce<T>(port: string, fn: (acc: T, env: EmissionEnvelope)=>T, seed: T): T;
  ports(): string[];
  setMax(max: number): void;
}

interface PortBuffer { list: EmissionEnvelope[]; }

export class InMemoryInputBufferStore implements InputBufferStore {
  private buffers: Record<string, PortBuffer> = {};
  private maxPerPort: number | undefined;

  constructor(opts: { maxPerPort?: number } = {}){
    this.maxPerPort = opts.maxPerPort;
  }

  setMax(max: number){ this.maxPerPort = max; }

  append(port: string, env: EmissionEnvelope){
    const buf = this.buffers[port] || (this.buffers[port] = { list: [] });
    buf.list.push(env);
    if(this.maxPerPort && buf.list.length > this.maxPerPort){
      // Evict oldest (ring buffer behavior)
      while(buf.list.length > this.maxPerPort){ buf.list.shift(); }
    }
  }
  getLatest(port: string){
    const buf = this.buffers[port];
    if(!buf || !buf.list.length) return undefined;
    return buf.list[buf.list.length - 1];
  }
  getAll(port: string){
    const buf = this.buffers[port];
    return buf ? [...buf.list] : [];
  }
  window(port: string, n: number){
    if(n <= 0) return [];
    const buf = this.buffers[port];
    if(!buf) return [];
    return buf.list.slice(-n);
  }
  since(port: string, ts: number){
    const buf = this.buffers[port];
    if(!buf) return [];
    return buf.list.filter(e => e.ts >= ts);
  }
  reduce<T>(port: string, fn: (acc: T, env: EmissionEnvelope)=>T, seed: T){
    const buf = this.buffers[port];
    let acc = seed;
    if(!buf) return acc;
    for(const env of buf.list){ acc = fn(acc, env); }
    return acc;
  }
  ports(){ return Object.keys(this.buffers); }
}
