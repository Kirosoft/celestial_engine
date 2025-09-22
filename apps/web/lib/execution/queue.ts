import { EmissionEnvelope, NodeCapabilities, DiagnosticsEvent } from './types';
import { InMemoryInputBufferStore } from './bufferStore';
import { historyMiddleware, logMiddleware } from './middlewares';
import { capabilityRegistry } from './capabilityRegistry';
import { nanoid } from 'nanoid';

// Simple orchestrator for new execution model (slice: queue + processEmission)

export interface ProcessEmissionOptions {
  targetNodeId: string;
  targetType: string;
  getTargetProps?: () => Promise<Record<string, any>>;
  updateTargetProps?: (patch: Record<string, any>) => Promise<void>;
  bufferStore: InMemoryInputBufferStore; // per-target store (could be global keyed by node later)
}

export interface ProcessEmissionResult {
  diagnostics: DiagnosticsEvent[];
  autoExecute: boolean;
}

export async function processEmission(env: EmissionEnvelope, opts: ProcessEmissionOptions): Promise<ProcessEmissionResult> {
  const diagnostics: DiagnosticsEvent[] = [];
  // 1. buffer append
  opts.bufferStore.append(env.toPort, env);
  diagnostics.push({ kind: 'buffer_append', ts: Date.now(), data: { toPort: env.toPort, node: opts.targetNodeId } });

  const caps: NodeCapabilities | undefined = capabilityRegistry.get(opts.targetType);

  // 2. middlewares
  const mwCtx = {
    targetNodeId: opts.targetNodeId,
    targetType: opts.targetType,
    getTargetProps: opts.getTargetProps,
    updateTargetProps: opts.updateTargetProps
  };
  const historyRes = await historyMiddleware(env, caps, mwCtx).catch(()=> undefined);
  if(historyRes?.diagnostics){
    for(const d of historyRes.diagnostics){ diagnostics.push({ kind: d.kind, ts: d.ts, data: d.data, }); }
  }
  const logRes = await logMiddleware(env, caps, mwCtx).catch(()=> undefined);
  if(logRes?.diagnostics){
    for(const d of logRes.diagnostics){ diagnostics.push({ kind: d.kind, ts: d.ts, data: d.data, }); }
  }

  // 3. auto-exec scheduling decision
  const autoExecute = !!caps?.autoExecuteOnInput;
  if(autoExecute){
    diagnostics.push({ kind: 'auto_exec_scheduled', ts: Date.now(), data: { targetNodeId: opts.targetNodeId } });
  }

  return { diagnostics, autoExecute };
}

// Basic FIFO queue; future: priority, batching, concurrency gates
interface QueueItem { env: EmissionEnvelope; opts: ProcessEmissionOptions; }
const q: QueueItem[] = [];
let draining = false;

export function enqueueEmission(env: EmissionEnvelope, opts: ProcessEmissionOptions){
  q.push({ env, opts });
}

export async function drainQueue(runAutoExec: (nodeId: string, trigger?: EmissionEnvelope) => Promise<void>){
  if(draining) return; // prevent re-entrancy
  draining = true;
  try {
    while(q.length){
      const { env, opts } = q.shift()!;
      const res = await processEmission(env, opts);
      if(res.autoExecute){
        await runAutoExec(opts.targetNodeId, env);
      }
    }
  } finally {
    draining = false;
  }
}

export function createEnvelope(partial: Omit<EmissionEnvelope, 'id'|'ts'>): EmissionEnvelope {
  return { id: nanoid(10), ts: Date.now(), ...partial } as EmissionEnvelope;
}
