import os from 'node:os';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function devtrackNetworkInterfacesPlugin(): Plugin {
  return {
    name: 'devtrack-network-interfaces',
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

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ interfaces }));
      });
    },
  };
}

export default defineConfig({
  plugins: [devtrackNetworkInterfacesPlugin(), react(), tailwindcss()],
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
