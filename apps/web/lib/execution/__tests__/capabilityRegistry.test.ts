import { describe, test, expect } from 'vitest';
import { capabilityRegistry } from '../capabilityRegistry';

describe('capabilityRegistry', () => {
  test('baseline registrations exist', () => {
    const chat = capabilityRegistry.get('ChatNode');
    const log = capabilityRegistry.get('LogNode');
    const llm = capabilityRegistry.get('LLM');
    expect(chat?.receivesHistory).toBe(true);
    expect(log?.logsInputs).toBe(true);
    expect(llm?.assistantEmitter).toBe(true);
  });

  test('register override', () => {
    capabilityRegistry.register({ type: 'TempNode', autoExecuteOnInput: true });
    const temp = capabilityRegistry.get('TempNode');
    expect(temp?.autoExecuteOnInput).toBe(true);
  });
});
