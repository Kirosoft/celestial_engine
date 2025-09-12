import { assertValidEnvelope, CommandEnvelope } from './commandSchemas';
import { VersionRepo } from './versionRepo';
import { NodeRepo } from './nodeRepo';
import { EventLog } from './eventLog';
import { nanoid } from 'nanoid';
import { ValidationError, ConflictError } from './errors';

interface DispatchResult { accepted: boolean; version: number; events: any[]; duplicate?: boolean }

async function applyAction(act: any, events: any[], env: CommandEnvelope){
  switch(act.type){
    case 'add_node': {
      const node = await NodeRepo.createNode(act.nodeType, act.name, act.props||{});
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'NodeAdded', data: { nodeId: node.id }, version: 0 });
      return; }
    case 'update_node': {
      const node = await NodeRepo.updateNode(act.id, { name: act.name, props: act.props });
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'NodeUpdated', data: { nodeId: node.id }, version: 0 });
      return; }
    case 'rename_node': {
      const node = await NodeRepo.renameNode(act.id, act.newId);
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'NodeRenamed', data: { oldId: act.id, newId: node.id }, version: 0 });
      return; }
    case 'move_node': {
      const node = await NodeRepo.updateNodePosition(act.id, { x: act.x, y: act.y });
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'NodeMoved', data: { nodeId: node.id, x: act.x, y: act.y }, version: 0 });
      return; }
    case 'delete_node': {
      await NodeRepo.deleteNode(act.id);
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'NodeDeleted', data: { nodeId: act.id }, version: 0 });
      return; }
    case 'add_edge': {
      const edge = await NodeRepo.addEdge(act.sourceId, act.targetId, act.kind||'flow');
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'EdgeAdded', data: { sourceId: act.sourceId, edgeId: edge.id }, version: 0 });
      return; }
    case 'update_edge': {
      const edge = await NodeRepo.updateEdge(act.sourceId, act.edgeId, { targetId: act.targetId, kind: act.kind });
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'EdgeUpdated', data: { sourceId: act.sourceId, edgeId: edge.id }, version: 0 });
      return; }
    case 'remove_edge': {
      await NodeRepo.removeEdge(act.sourceId, act.edgeId);
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'EdgeRemoved', data: { sourceId: act.sourceId, edgeId: act.edgeId }, version: 0 });
      return; }
    case 'snapshot_graph': {
      // Placeholder; will integrate with snapshot module later
      events.push({ id: nanoid(), ts: new Date().toISOString(), commandId: env.id, type: 'SnapshotRequested', data: { label: act.label||'' }, version: 0 });
      return; }
    default:
      throw new ValidationError([{ path: 'type', message: `Unsupported action type: ${act.type}` }]);
  }
}

export async function dispatchCommand(envelope: CommandEnvelope): Promise<DispatchResult>{
  await assertValidEnvelope(envelope);
  const beforeVersion = await VersionRepo.getVersion();
  if(typeof envelope.expected_version === 'number' && envelope.expected_version !== beforeVersion){
    throw new ConflictError(`expected_version ${envelope.expected_version} does not match current ${beforeVersion}`);
  }
  const idem = await VersionRepo.checkIdempotency(envelope.idempotency_key||'', envelope);
  if(idem.duplicate){
    return { accepted: false, duplicate: true, events: [], version: beforeVersion };
  }
  if((idem as any).conflict){
    throw new ConflictError('Idempotency key conflict');
  }
  const events: any[] = [];
  for(const act of envelope.actions){
    await applyAction(act, events, envelope);
  }
  const newVersion = await VersionRepo.bumpVersion();
  for(const e of events) e.version = newVersion;
  await EventLog.appendEvents(events);
  return { accepted: true, version: newVersion, events };
}

export const Dispatcher = { dispatchCommand };
