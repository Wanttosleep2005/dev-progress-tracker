import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: import('node:http').ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function devtrackLocalToolsPlugin(): Plugin {
  return {
    name: 'devtrack-local-tools',
    configureServer(server) {
      server.middlewares.use('/__devtrack/network-interfaces', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }

        const interfaces = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
          (addresses || [])
            .filter(item => item.family === 'IPv4' && !item.internal)
            .map(item => ({
              name,
              address: item.address,
              radmin: item.address.startsWith('26.') || /radmin/i.test(name),
            }))
        );

        sendJson(res, 200, { interfaces });
      });

      server.middlewares.use('/__devtrack/write-backup', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = JSON.parse(await readRequestBody(req)) as {
            directory?: string;
            filename?: string;
            content?: string;
          };
          const directory = body.directory?.trim();
          const content = body.content;
          if (!directory || !content) {
            sendJson(res, 400, { error: 'Missing backup directory or content' });
            return;
          }

          const filename = path.basename(body.filename || `devtrack-data-backup-${new Date().toISOString().slice(0, 10)}.json`);
          const safeFilename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/^\.+/, '') || 'devtrack-data-backup.json';
          const targetDir = path.resolve(directory);
          const targetPath = path.join(targetDir, safeFilename.endsWith('.json') ? safeFilename : `${safeFilename}.json`);

          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(targetPath, content, 'utf8');
          sendJson(res, 200, { path: targetPath, size: Buffer.byteLength(content, 'utf8') });
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : 'Write backup failed' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [devtrackLocalToolsPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
          if (id.includes('react-markdown') || id.includes('remark-gfm')) return 'markdown';
          if (id.includes('dexie')) return 'storage';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
