import { Router } from 'express';
import runsRouter from './runs.js';
import testsRouter from './tests.js';
import insightsRouter from './insights.js';
import { checkConnection } from '../db/index.js';

const router: Router = Router();

router.use('/runs', runsRouter);
router.use('/tests', testsRouter);
router.use('/insights', insightsRouter);

// Health check endpoint with database connectivity check
router.get('/health', async (_, res) => {
  const startTime = Date.now();
  const dbHealthy = await checkConnection();
  const responseTime = Date.now() - startTime;

  const health = {
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    responseTimeMs: responseTime,
  };

  // Return 503 if database is down (for load balancer health checks)
  res.status(dbHealthy ? 200 : 503).json(health);
});

export default router;
