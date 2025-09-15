import type { NextApiRequest, NextApiResponse } from 'next';
import { methodNotAllowed, sendError } from '../../../../lib/apiErrors';
import { FileRepo } from '../../../../lib/fileRepo';
import { GroupRepo } from '../../../../lib/groupRepo';
import { assertValidNode } from '../../../../lib/validator';

// PATCH /api/groups/:id/ports
// Body: { inputs: string[], outputs: string[] }
// Replaces the group's ports set (add/remove) and syncs proxy nodes accordingly.
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    if(req.method !== 'PATCH') return methodNotAllowed(res);
    const { id } = req.query as { id: string };
    const path = `nodes/${id}.json`;
    const exists = await FileRepo.exists(path);
    if(!exists){
      return res.status(404).json({ error: { code: 'group_not_found', message: `Group not found: ${id}` } });
    }
    const groupNode = await FileRepo.readJson<any>(path);
    if(groupNode.type !== 'Group'){
      return res.status(400).json({ error: { code: 'not_a_group', message: `Node is not a Group: ${id}` } });
    }
    const { inputs = [], outputs = [] } = req.body || {};
    if(!Array.isArray(inputs) || !Array.isArray(outputs)){
      return res.status(400).json({ error: { code: 'invalid_ports_payload', message: 'inputs and outputs must be arrays' } });
    }
    const pattern = /^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/;
    const all = [...inputs, ...outputs];
    const bad = all.filter(p=>!pattern.test(p));
    if(bad.length){
      return res.status(400).json({ error: { code: 'invalid_port_name', message: 'Invalid port name(s): '+bad.join(',') } });
    }
    const overlap = inputs.filter(p=> outputs.includes(p));
    if(overlap.length){
      return res.status(400).json({ error: { code: 'ports_not_disjoint', message: 'Input/output port names must be disjoint: '+overlap.join(',') } });
    }
    const prevInputs: string[] = groupNode.ports?.inputs || [];
    const prevOutputs: string[] = groupNode.ports?.outputs || [];

    // Diff
    const addedInputs = inputs.filter(p=> !prevInputs.includes(p));
    const removedInputs = prevInputs.filter(p=> !inputs.includes(p));
    const addedOutputs = outputs.filter(p=> !prevOutputs.includes(p));
    const removedOutputs = prevOutputs.filter(p=> !outputs.includes(p));

    // Update node
    groupNode.ports = { inputs: [...inputs], outputs: [...outputs] };
    await assertValidNode(groupNode); // still satisfies schema
    await FileRepo.writeJson(path, groupNode);

    // Apply proxy changes
    for(const p of addedInputs) await GroupRepo.createProxyNode(id, 'input', p);
    for(const p of addedOutputs) await GroupRepo.createProxyNode(id, 'output', p);
    for(const p of removedInputs) await GroupRepo.deleteProxyNode(id, 'input', p);
    for(const p of removedOutputs) await GroupRepo.deleteProxyNode(id, 'output', p);

    return res.status(200).json({ group: groupNode, changes: { addedInputs, removedInputs, addedOutputs, removedOutputs } });
  } catch(e){
    return sendError(res, e);
  }
}
