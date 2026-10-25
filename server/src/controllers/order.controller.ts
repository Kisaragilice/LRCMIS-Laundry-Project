import type { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import { createOrderFromReservation } from '../services/order.service';
import { created, ok, paginationMeta, parsePagination } from '../utils/http';
import { orderDto } from '../utils/serializers';
import { clientIp } from '../services/audit.service';

function actor(req: Request) {
  return { userId: req.auth!.userId, roles: req.auth!.roles };
}

export async function listMine(req: Request, res: Response) {
  const orders = await orderService.listMyOrders(req.auth!.userId);
  return ok(res, orders.map((order) => orderDto(order)));
}

export async function getOne(req: Request, res: Response) {
  const order = await orderService.getOrder(actor(req), req.params.id);
  return ok(
    res,
    orderDto(order, {
      includeCustomer: req.auth!.roles.some((role) => ['admin', 'staff', 'owner'].includes(role)),
    }),
  );
}

export async function adminList(req: Request, res: Response) {
  const q = req.query as unknown as {
    orderStatus?: string;
    paymentStatus?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  };
  const { page, limit, skip } = parsePagination(q);
  const result = await orderService.listOrdersForAdmin({ ...q, page, limit, skip });
  return ok(
    res,
    result.rows.map((order) => orderDto(order, { includeCustomer: true })),
    paginationMeta(result.total, page, limit),
  );
}

export async function createFromReservation(req: Request, res: Response) {
  const order = await createOrderFromReservation(
    req.auth!.userId,
    req.params.id,
    req.body?.notes,
    clientIp(req),
  );
  return created(res, orderDto(order, { includeCustomer: true }));
}

export async function receive(req: Request, res: Response) {
  const order = await orderService.receiveOrder(req.auth!.userId, req.params.id, req.body, clientIp(req));
  return ok(res, orderDto(order, { includeCustomer: true }));
}

export async function changeStatus(req: Request, res: Response) {
  const order = await orderService.updateOrderStatus(
    actor(req),
    req.params.id,
    req.body.status,
    req.body.notes,
    clientIp(req),
  );
  return ok(res, orderDto(order, { includeCustomer: true }));
}

export async function assignStaff(req: Request, res: Response) {
  const order = await orderService.assignStaff(actor(req), req.params.id, req.body.staffId, clientIp(req));
  return ok(res, orderDto(order, { includeCustomer: true }));
}

export async function addNote(req: Request, res: Response) {
  const note = await orderService.addOrderNote(actor(req), req.params.id, req.body.note, clientIp(req));
  return created(res, note);
}

export async function listNotes(req: Request, res: Response) {
  const order = await orderService.getOrder(actor(req), req.params.id);
  const notes = await orderService.listOrderNotes(order.id);
  return ok(
    res,
    notes.map((note) => ({
      id: note.id,
      note: note.note,
      createdAt: note.createdAt,
      author: { id: note.user.id, name: note.user.name },
    })),
  );
}

export async function staffList(req: Request, res: Response) {
  const orders = await orderService.listOrdersForStaff(req.auth!.userId);
  return ok(res, orders.map((order) => orderDto(order, { includeCustomer: true })));
}
