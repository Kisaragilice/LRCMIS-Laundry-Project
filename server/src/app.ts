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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('Origin tidak diizinkan oleh CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    }),
  );
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
