import { NotFoundError, ValidationError, ConflictError, CycleError, PathEscapeError } from './errors';
import type { NextApiResponse } from 'next';

export interface ErrorBody { error: { code: string; message: string }; errors?: any[] }

export function sendError(res: NextApiResponse, err: any){
  const body: ErrorBody = { error: { code: 'internal_error', message: 'Internal Server Error' } };
  let status = 500;
  if(err instanceof ValidationError){ status = 400; body.error.code = 'validation_error'; body.error.message = err.message; body.errors = err.errors; }
  else if(err instanceof NotFoundError){ status = 404; body.error.code = 'not_found'; body.error.message = err.message; }
  else if(err instanceof ConflictError){ status = 409; body.error.code = 'conflict'; body.error.message = err.message; }
  else if(err instanceof CycleError){ status = 409; body.error.code = 'cycle'; body.error.message = err.message; }
  else if(err instanceof PathEscapeError){ status = 400; body.error.code = 'bad_path'; body.error.message = err.message; }
  else if(err?.errors){ status = 400; body.error.code = 'bad_request'; body.error.message = err.message || 'Bad Request'; body.errors = err.errors; }
  res.status(status).json(body);
}

export function methodNotAllowed(res: NextApiResponse){
  res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method Not Allowed' } });
}