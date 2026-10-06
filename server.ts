import express from 'express';
import dotenv from 'dotenv';
import { handleAIQueryRequest } from './src/server/handler';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Mount API routes
app.all('/api/ai/query', (req, res) => {
  return handleAIQueryRequest(req, res);
});

// Mount Vite middleware in development, or serve static dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const fs = await import('fs/promises');
    const path = await import('path');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        if (e instanceof Error) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const path = await import('path');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Forex Journal server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
