import { Router } from 'express';
import runsRouter from './runs.js';
import testsRouter from './tests.js';
import insightsRouter from './insights.js';

const router: Router = Router();

router.use('/runs', runsRouter);
router.use('/tests', testsRouter);
router.use('/insights', insightsRouter);

// Health check endpoint
router.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
