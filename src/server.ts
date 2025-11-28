import express, { Express, Request, Response } from 'express';
import { config } from './config';
import uploadRouter from './routes/upload';
import publicRouter from './routes/public';
import healthRouter from './routes/health';
import filesRouter from './routes/files';
import authRouter from './routes/auth';
import statsRouter from './routes/stats';
import { runMigrations } from './db/migrate';

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first (before static files)
app.use('/upload', uploadRouter);
app.use('/v', publicRouter);
app.use('/health', healthRouter);
app.use('/files', filesRouter);
app.use('/auth', authRouter);
app.use('/stats', statsRouter);

// Serve static files from public directory (for images at root)
app.use(express.static('public', { index: false }));

// Serve app static files (built by Vite in public/app/)
app.use('/app', express.static('public/app'));

// Landing page on root
app.get('/', (req: Request, res: Response) => {
  res.sendFile('landing.html', { root: 'public' });
});

// SPA fallback for /app - serve index.html for all /app routes
app.get('/app*', (req: Request, res: Response) => {
  res.sendFile('index.html', { root: 'public/app' });
});

async function startServer() {
  try {
    // Run migrations before starting server
    await runMigrations();

    app.listen(config.port, () => {
      console.log(`🚀 echo-link server running on port ${config.port}`);
      console.log(`📊 Health check: http://localhost:${config.port}/health`);
      console.log(`🔗 Public base URL: ${config.publicBaseUrl}`);
      console.log(`📦 S3 endpoint: ${config.s3.endpoint}`);
      console.log(`🪣 S3 bucket: ${config.s3.bucket}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server with migrations
startServer();

export default app;
