import type { NextApiRequest, NextApiResponse } from 'next';

export interface InvokeResult<T=any>{ status: number; json?: T; headers: Record<string,string>; }

export async function invoke(handler: (req: NextApiRequest, res: NextApiResponse)=>any, options: {
  method?: string; query?: Record<string, any>; body?: any;
}): Promise<InvokeResult>{
  let statusCode = 0;
  let jsonBody: any = undefined;
  const headers: Record<string,string> = {};
  const req = { method: options.method||'GET', query: options.query||{}, body: options.body } as any as NextApiRequest;
  const res: Partial<NextApiResponse> = {
    status(code: number){ statusCode = code; return this as any; },
    json(data: any){ jsonBody = data; if(statusCode===0) statusCode = 200; return this as any; },
    end(){ if(statusCode===0) statusCode = 200; return this as any; },
    setHeader(k: string, v: string){ headers[k.toLowerCase()] = v; return this as any; }
  };
  await handler(req, res as NextApiResponse);
  return { status: statusCode, json: jsonBody, headers };
}
