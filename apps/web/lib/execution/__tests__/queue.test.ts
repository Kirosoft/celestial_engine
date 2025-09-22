import { describe, test, expect } from 'vitest';
import { createEnvelope, enqueueEmission, drainQueue } from '../queue';
import { InMemoryInputBufferStore } from '../bufferStore';
import { capabilityRegistry } from '../capabilityRegistry';

// We simulate a target node that auto-executes by adding capability on the fly
capabilityRegistry.register({ type: 'AutoNode', autoExecuteOnInput: true });

function makeStore(){ return new InMemoryInputBufferStore(); }

describe('queue/processEmission', () => {
  test('buffer_append and auto_exec_scheduled diagnostics', async () => {
    const store = makeStore();
    const diagnostics: any[] = [];
    // Wrap runAutoExec to capture invocation
    let autoRan = 0;
    enqueueEmission(createEnvelope({ fromNodeId:'A', fromPort:'out', toNodeId:'B', toPort:'in', value:42 }), {
      targetNodeId:'B',
      targetType:'AutoNode',
      bufferStore: store,
      getTargetProps: async () => ({}),
      updateTargetProps: async () => {}
    });
    await drainQueue(async () => { autoRan++; });
    // We can't directly access internal diagnostics yet; rely on side effects
    expect(store.getLatest('in')?.value).toBe(42);
    expect(autoRan).toBe(1);
  });
});
