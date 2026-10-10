import { tsImport } from 'tsx/esm/api';

export default async function handler(req: any, res: any) {
  const parentUrl = `file://${process.cwd()}/api/ai/query.js`;
  const { handleAIQueryRequest } = await tsImport('../../src/server/handler.ts', parentUrl);
  return handleAIQueryRequest(req, res);
}
