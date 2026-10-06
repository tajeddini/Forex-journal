import { handleAIQueryRequest } from '../../src/server/handler';

export default async function handler(req: any, res: any) {
  return handleAIQueryRequest(req, res);
}
