import express, { Express, Request, Response } from 'express';
import { config } from './config';
import uploadRouter from './routes/upload';
import publicRouter from './routes/public';
import healthRouter from './routes/health';

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

app.use('/upload', uploadRouter);
app.use('/v', publicRouter);
app.use('/health', healthRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'echo-link',
    version: '1.0.0',
    status: 'running',
  });
});

app.listen(config.port, () => {
  console.log(`🚀 echo-link server running on port ${config.port}`);
  console.log(`📊 Health check: http://localhost:${config.port}/health`);
  console.log(`🔗 Public base URL: ${config.publicBaseUrl}`);
  console.log(`📦 S3 endpoint: ${config.s3.endpoint}`);
  console.log(`🪣 S3 bucket: ${config.s3.bucket}`);
});

export default app;
