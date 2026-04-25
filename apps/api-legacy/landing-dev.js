/**
 * Simple dev server for landing page with live reload
 * Usage: node landing-dev.js
 */

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 3001;

// Serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Serve static assets
app.use(express.static('public'));

// Create WebSocket server for live reload
const server = app.listen(PORT, () => {
  console.log(`🚀 Landing page dev server running at http://localhost:${PORT}`);
  console.log(`📝 Edit public/landing.html and it will auto-reload`);
});

const wss = new WebSocketServer({ server });

// Watch landing.html for changes
const watcher = chokidar.watch('public/landing.html', {
  ignoreInitial: true,
});

watcher.on('change', (path) => {
  console.log(`✨ ${path} changed, reloading browsers...`);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send('reload');
    }
  });
});

// Inject live reload script into landing page
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'string' && data.includes('</body>')) {
      const script = `
        <script>
          const ws = new WebSocket('ws://localhost:${PORT}');
          ws.onmessage = (event) => {
            if (event.data === 'reload') {
              console.log('🔄 Reloading...');
              location.reload();
            }
          };
          ws.onopen = () => console.log('🔗 Live reload connected');
          ws.onerror = () => console.log('❌ Live reload connection failed');
        </script>
      `;
      data = data.replace('</body>', `${script}</body>`);
    }
    originalSend.call(this, data);
  };
  next();
});

process.on('SIGINT', () => {
  console.log('\n👋 Closing dev server...');
  watcher.close();
  server.close();
  process.exit(0);
});
