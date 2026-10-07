// ============================================================
// Server AI Query Handler
// Unified request handler for Express server and Vercel functions
// Tightened CORS security and BYOK provider config support
// ============================================================

import { executeServerAIQuery } from '../services/ai/server-orchestrator';
import { AIError } from '../services/ai/types';

function applySecureCors(req: any, res: any): boolean {
  const origin = req.headers?.origin || req.headers?.Origin || '';
  const isProd = process.env.NODE_ENV === 'production';

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (isProd) {
    // In production, strictly restrict allowed origins (no wildcard with Bearer auth)
    const allowedOrigins = [
      process.env.APP_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ]
      .filter(Boolean)
      .map(value => String(value).replace(/\/$/, '').toLowerCase());

    const normalizedOrigin = String(origin).replace(/\/$/, '').toLowerCase();

    if (!origin) {
      // Same-origin/server-to-server request: no CORS allow-origin header is required.
    } else if (allowedOrigins.includes(normalizedOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      // Never reflect or wildcard an untrusted origin.
      res.setHeader('Access-Control-Allow-Origin', 'null');
    }
  } else {
    // Development/testing
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export async function handleAIQueryRequest(req: any, res: any) {
  // Set hardened CORS headers
  if (applySecureCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'متد مجاز نیست. تنها درخواست‌های POST پشتیبانی می‌شوند.',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'احراز هویت الزامی است. لطفاً توکن معتبر ارسال کنید.',
        code: 'PERMISSION_DENIED',
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({
        error: 'توکن دسترسی خالی است.',
        code: 'PERMISSION_DENIED',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { question, accountId, phaseId, providerConfig } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'متن سوال الزامی است.',
        code: 'QUERY_VALIDATION_FAILED',
      });
    }

    const result = await executeServerAIQuery({
      token,
      question: question.trim(),
      accountId: accountId || undefined,
      phaseId: phaseId || undefined,
      providerConfig: providerConfig || undefined,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof AIError) {
      const statusCode =
        err.code === 'PERMISSION_DENIED'
          ? 401
          : err.code === 'QUERY_VALIDATION_FAILED'
          ? 400
          : err.code === 'API_KEY_MISSING' || err.code === 'AI_PROVIDER_NOT_CONFIGURED'
          ? 503
          : 500;

      return res.status(statusCode).json({
        error: err.message,
        code: err.code,
      });
    }

    const message = err instanceof Error ? err.message : 'خطای ناشناخته در سرور هوش مصنوعی';
    return res.status(500).json({
      error: message,
      code: 'UNKNOWN_ERROR',
    });
  }
}
