export class PathEscapeError extends Error { constructor(public attempted: string){ super(`Path escapes repo root: ${attempted}`);} }
export class NotFoundError extends Error { constructor(entity: string, id: string){ super(`${entity} not found: ${id}`);} }
export class ValidationError extends Error { constructor(public errors: any[]){ super('Validation failed'); } }
export class ConflictError extends Error { constructor(message: string){ super(message);} }
export class CycleError extends Error { constructor(message='Edge would create a cycle'){ super(message);} }
