import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authRouter } from './modules/auth/auth.routes.js';
import { travelsRouter } from './modules/travels/travels.routes.js';
import { activityLogsRouter } from './modules/activityLogs/activityLogs.routes.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/travels', travelsRouter);
app.use('/api/activity-logs', activityLogsRouter);

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err?.status ?? 500;
  res.status(status).json({
    error: {
      message: err?.message ?? 'Erreur interne',
      code: err?.code ?? 'INTERNAL_ERROR'
    }
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API en écoute sur :${port}`);
});

