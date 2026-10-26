import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env, isTest } from './config/env';
import { apiRouter } from './routes';
import { csrfProtection } from './middlewares/auth';
import { generalLimiter } from './middlewares/rateLimit';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { openApiDocument } from './config/openapi';
import { AppError } from './utils/errors';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const allowedOrigins = env.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use((req, res, next) => {
    // The web UI is normally served from the same origin as /api through Nginx.
    // Accepting the request's own origin makes LAN IP/port or tunnel hostname
    // changes work without editing CLIENT_ORIGIN, while still rejecting CSRF
    // requests coming from a different origin.
    const requestHost = req.headers.host;
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);

        if (requestHost) {
          try {
            if (new URL(origin).host === requestHost) return callback(null, true);
          } catch {
            // Malformed Origin header: fall through to the deny branch.
          }
        }

        if (env.NODE_ENV !== 'production') return callback(null, true);
        return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin tidak diizinkan oleh CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    })(req, res, next);
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(generalLimiter);
  app.use(csrfProtection);

  if (!isTest()) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        if (req.path === '/health') return;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  app.use('/api/v1', apiRouter);
  app.get('/api/docs.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'LRCMIS API' }));
  app.get('/', (_req, res) =>
    res.json({
      success: true,
      data: {
        name: 'LRCMIS API',
        version: '1.0.0',
        documentation: '/api/docs',
        api: '/api/v1',
      },
    }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
