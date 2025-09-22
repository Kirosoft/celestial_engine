import { CapabilityRegistry, NodeCapabilities } from './types';

// In-memory capability registry. Future: derive from JSON Schemas (x-capabilities)
const map = new Map<string, NodeCapabilities>();

export const capabilityRegistry: CapabilityRegistry = {
  register: (caps: NodeCapabilities) => {
    if(!caps?.type) throw new Error('Capability must include type');
    map.set(caps.type, { ...caps });
  },
  get: (type: string) => map.get(type),
  list: () => Array.from(map.values())
};

// Helper to bulk register (idempotent override)
export function registerCapabilities(list: NodeCapabilities[]){
  for(const caps of list){ capabilityRegistry.register(caps); }
}

// Provide a few baseline defaults; these can be refined later or moved to a bootstrap file.
registerCapabilities([
  { type: 'ChatNode', receivesHistory: true, autoExecuteOnInput: false },
  // LogNode does not execute an executor, but enabling autoExecuteOnInput allows us to schedule downstream emission if future transforms are added.
  { type: 'LogNode', logsInputs: true, autoExecuteOnInput: false },
  // LLM should auto-execute when it receives new inputs so downstream nodes (e.g. LogNode) get assistant output.
  { type: 'LLM', assistantEmitter: true, autoExecuteOnInput: true },
]);
