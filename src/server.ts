import express, { Express, Request, Response } from 'express';
import { config } from './config';
import { runMigrations } from './db/migrate';
import authRouter from './routes/auth';
import cleanupRouter from './routes/cleanup';
import deleteRouter from './routes/delete';
import discordRouter from './routes/discord';
import filesRouter from './routes/files';
import healthRouter from './routes/health';
import publicRouter from './routes/public';
import statsRouter from './routes/stats';
import uploadRouter from './routes/upload';
import { cleanupExpiredFiles } from './services/fileService';

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
app.use('/cleanup', cleanupRouter);
app.use('/delete', deleteRouter);
app.use('/discord', discordRouter);

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
      console.log(`📁 File expiration: ${config.files.expirationDays} days`);

      // Schedule daily cleanup at midnight
      scheduleCleanup();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server with migrations
startServer();

// Schedule cleanup to run at midnight every day
function scheduleCleanup() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight

  const msUntilMidnight = midnight.getTime() - now.getTime();

  console.log(`🧹 Cleanup scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);

  // Schedule first cleanup at next midnight
  setTimeout(() => {
    runCleanup();
    // Then run every 24 hours
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

async function runCleanup() {
  console.log('🧹 Running scheduled cleanup...');
  try {
    const result = await cleanupExpiredFiles();
    console.log(`🧹 Cleanup completed: ${result.deleted} files deleted, ${result.errors} errors`);
  } catch (error) {
    console.error('🧹 Cleanup failed:', error);
  }
}

export default app;
