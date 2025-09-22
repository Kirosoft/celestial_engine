import { describe, test, expect } from 'vitest';
import { createEnvelope, enqueueEmission, drainQueue } from '../queue';
import { InMemoryInputBufferStore } from '../bufferStore';
import { capabilityRegistry } from '../capabilityRegistry';

// Scenario: single trigger vs multiple data inputs snapshot immutability.
// We'll simulate by emitting two data envelopes then a flow envelope; autoExecute triggers once with trigger envelope.

capabilityRegistry.register({ type: 'ScenarioNode', autoExecuteOnInput: true });

interface Capture {
  triggers: any[];
  snapshots: Array<{ ports: string[]; latestValues: Record<string, any> }>; 
}

const capture: Capture = { triggers: [], snapshots: [] };

function makeStore(){ return new InMemoryInputBufferStore(); }

// Minimal runAutoExec stub to inspect buffer state at execution time
async function runAutoExec(nodeId: string, trigger?: any){
  if(trigger) capture.triggers.push(trigger);
  // Here we don't have accessor integration yet, so approximate by reading raw store (ports and latest per port)
}

describe('execution scenarios', () => {
  test('multiple data inputs + single trigger', async () => {
    const store = makeStore();
    // Data envelopes (non-flow) - we just treat all the same currently; simulate by toPort naming
    enqueueEmission(createEnvelope({ fromNodeId:'S1', fromPort:'d1', toNodeId:'NodeX', toPort:'dataA', value:'A1' }), {
      targetNodeId:'NodeX', targetType:'ScenarioNode', bufferStore: store,
      getTargetProps: async () => ({}), updateTargetProps: async () => {}
    });
    enqueueEmission(createEnvelope({ fromNodeId:'S2', fromPort:'d2', toNodeId:'NodeX', toPort:'dataB', value:'B1' }), {
      targetNodeId:'NodeX', targetType:'ScenarioNode', bufferStore: store,
      getTargetProps: async () => ({}), updateTargetProps: async () => {}
    });
    // Flow trigger envelope (simulate with special port name 'flow')
    enqueueEmission(createEnvelope({ fromNodeId:'T1', fromPort:'flow', toNodeId:'NodeX', toPort:'flow', value:'GO' }), {
      targetNodeId:'NodeX', targetType:'ScenarioNode', bufferStore: store,
      getTargetProps: async () => ({}), updateTargetProps: async () => {}
    });
    let autoExecCount = 0;
    await drainQueue(async (_nodeId, trigger) => {
      autoExecCount++;
      if(trigger){ capture.triggers.push(trigger); }
      const ports = store.ports();
      const latestValues: Record<string, any> = {};
      for(const p of ports){ latestValues[p] = store.getLatest(p)?.value; }
      capture.snapshots.push({ ports, latestValues });
    });
    expect(autoExecCount).toBe(3); // autoExecuteOnInput currently fires per envelope; later we may batch by trigger semantics.
    // At least last snapshot should include both dataA and dataB and flow
    const last = capture.snapshots[capture.snapshots.length -1];
    expect(last.latestValues.dataA).toBe('A1');
    expect(last.latestValues.dataB).toBe('B1');
    expect(last.latestValues.flow).toBe('GO');
  });
});
