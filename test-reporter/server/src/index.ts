import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import routes from './routes/index.js';
import { checkConnection } from './db/index.js';

const app: Express = express();

// Middleware
app.use(helmet());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: config.maxPayloadSize }));

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (_, res) => {
  res.json({
    name: 'test-reporter',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  // Check database connection
  console.log('Checking database connection...');
  const connected = await checkConnection();
  if (!connected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected successfully.');

  // Start listening
  app.listen(config.port, () => {
    console.log(`test-reporter server listening on port ${config.port}`);
    console.log(`Environment: ${config.env}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
