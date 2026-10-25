import { Router } from 'express';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { catalogRouter, customerRouter } from './public.routes';
import { adminRouter, courierRouter, publicRouter, staffRouter } from './admin.routes';
import { chatRouter } from './chat.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'lrcmis-api', time: new Date().toISOString() } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/', catalogRouter);
apiRouter.use('/', publicRouter);
apiRouter.use('/', customerRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/staff', staffRouter);
apiRouter.use('/courier', courierRouter);
