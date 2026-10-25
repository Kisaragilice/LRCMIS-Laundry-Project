import type { Request, Response } from 'express';
import * as deliveryService from '../services/delivery.service';
import { ok, paginationMeta, parsePagination, created } from '../utils/http';
import { taskDto } from '../utils/serializers';
import { clientIp } from '../services/audit.service';

export async function myTasks(req: Request, res: Response) {
  const tasks = await deliveryService.listCourierTasks(req.auth!.userId);
  return ok(res, tasks.map(taskDto));
}

export async function getTask(req: Request, res: Response) {
  const task = await deliveryService.getCourierTask(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
  );
  return ok(res, taskDto(task));
}

export async function updateStatus(req: Request, res: Response) {
  const task = await deliveryService.updateTaskStatus(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
    req.body,
    clientIp(req),
  );
  return ok(res, taskDto(task));
}

export async function adminList(req: Request, res: Response) {
  const q = req.query as unknown as {
    status?: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'failed';
    courierId?: string;
    page?: number;
    limit?: number;
  };
  const { page, limit, skip } = parsePagination(q);
  const result = await deliveryService.listTasksForAdmin({ ...q, page, limit, skip });
  return ok(res, result.rows.map(taskDto), paginationMeta(result.total, page, limit));
}

export async function assign(req: Request, res: Response) {
  const task = await deliveryService.assignCourier(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
    req.body.courierId,
    clientIp(req),
  );
  return ok(res, taskDto(task));
}

export async function createTask(req: Request, res: Response) {
  const task = await deliveryService.createTask(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
    req.body,
    clientIp(req),
  );
  return created(res, taskDto(task));
}
