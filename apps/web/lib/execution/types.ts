// Core execution refactor foundational types
// Slice 1: capabilities & types

export interface EmissionEnvelope {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  value: any;
  ts: number;
  meta?: Record<string, any>;
}

export interface NodeCapabilities {
  type: string;
  autoExecuteOnInput?: boolean; // run executor after new input
  receivesHistory?: boolean;    // append inbound assistant/user messages
  logsInputs?: boolean;         // keep a log of inbound emissions
  assistantEmitter?: boolean;   // emissions treated as assistant messages
  maxInputBuffer?: number;      // per-port cap
  custom?: Record<string, any>; // extension bag
}

export interface DiagnosticsEvent {
  kind: string;
  ts: number;
  data?: Record<string, any>;
  level?: 'info'|'warn'|'error';
}

export interface ExecutionContextV2 {
  nodeId: string;
  nodeType: string;
  runId: string;
  trigger?: EmissionEnvelope;
  triggerKind?: 'flow' | 'manual' | 'scheduled';
  // inputs accessor & legacy fields will be wired in later slices
  // placeholder to avoid circular interim imports
  vars?: Record<string, any>;
}

export interface CapabilityRegistry {
  register: (caps: NodeCapabilities) => void;
  get: (type: string) => NodeCapabilities | undefined;
  list: () => NodeCapabilities[];
}
