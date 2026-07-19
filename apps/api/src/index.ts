import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

// Must load before route modules so Router.prototype is patched in time.
require('./lib/async-routes');

import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import projectRoutes from './routes/projects.routes';
import landRoutes from './routes/land.routes';
import crmRoutes from './routes/crm.routes';
import moduleRoutes from './routes/modules.routes';
import hrRoutes from './routes/hr.routes';
import feasibilityRoutes from './routes/feasibility.routes';
import propertiesRoutes from './routes/properties.routes';
import reportsRoutes from './routes/reports.routes';
import { prisma } from './lib/prisma';
import { assertJwtSecretsConfigured } from './lib/auth';
import { sendPrismaError } from './lib/route-utils';
import { corsOriginDelegate, getConfiguredOrigins } from './lib/cors';

const app = express();
const PORT = parseInt(process.env.API_PORT || '4000');

if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  // API is called cross-origin from Netlify/Vercel; disable CORP that can block reads
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: 'RSS ERP API', version: '1.0.0', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ success: false, message: 'Database unavailable', error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/land', landRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/feasibility', feasibilityRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', moduleRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found', error: 'Not found' }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', err);

  if (res.headersSent) {
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, message: 'Invalid JSON request body', error: 'Invalid JSON request body' });
    return;
  }

  if (err.message.startsWith('CORS blocked origin')) {
    res.status(403).json({ success: false, message: 'Origin is not allowed by CORS', error: 'Origin is not allowed by CORS' });
    return;
  }

  sendPrismaError(res, err, 'Internal server error');
});

async function start() {
  try {
    assertJwtSecretsConfigured();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed. Run "npm run db:start" from the project root.');
    console.error(error);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    const origins = getConfiguredOrigins();
    const allowLocal =
      process.env.NODE_ENV !== 'production' ||
      process.env.CORS_ALLOW_LOCALHOST === 'true' ||
      process.env.CORS_ALLOW_LOCALHOST === '1';
    console.log(`RSS ERP API running on http://localhost:${PORT}`);
    console.log(
      `CORS: origins=${origins.length ? origins.join(', ') : '(none)'}; localhost-any-port=${allowLocal ? 'yes' : 'no'}`
    );
    if (process.env.NODE_ENV === 'production' && origins.length === 0 && !process.env.NEXT_PUBLIC_APP_URL) {
      console.warn(
        'WARNING: No CORS_ORIGINS or NEXT_PUBLIC_APP_URL set in production. ' +
          'Browser requests from Netlify/Vercel will be blocked. Set CORS_ORIGINS=https://your-frontend.example.com'
      );
    }
  });
}

// Serverless hosts import this module — skip listen() and eager connect.
if (process.env.VERCEL || process.env.SKIP_API_LISTEN === '1') {
  try {
    assertJwtSecretsConfigured();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
} else {
  start();
}

export default app;
