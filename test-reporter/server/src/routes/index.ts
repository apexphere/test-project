import { Router } from 'express';
import runsRouter from './runs.js';

const router: Router = Router();

router.use('/runs', runsRouter);

// Health check endpoint
router.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
