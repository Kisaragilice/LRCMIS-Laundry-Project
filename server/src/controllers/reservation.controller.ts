import type { Request, Response } from 'express';
import * as reservationService from '../services/reservation.service';
import { parsePagination, paginationMeta, created, ok } from '../utils/http';
import { reservationDto } from '../utils/serializers';
import { clientIp } from '../services/audit.service';

export async function create(req: Request, res: Response) {
  const reservation = await reservationService.createReservation(req.auth!.userId, req.body, clientIp(req));
  return created(res, reservationDto(reservation));
}

export async function listMine(req: Request, res: Response) {
  const rows = await reservationService.listMyReservations(req.auth!.userId);
  return ok(res, rows.map(reservationDto));
}

export async function getOne(req: Request, res: Response) {
  const reservation = await reservationService.getReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
  );
  return ok(res, reservationDto(reservation));
}

export async function cancel(req: Request, res: Response) {
  const reservation = await reservationService.cancelReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
    clientIp(req),
    req.body?.reason,
  );
  const full = await reservationService.getReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    reservation.id,
  );
  return ok(res, reservationDto(full));
}

export async function adminList(req: Request, res: Response) {
  const q = req.query as unknown as {
    status?: string;
    date?: string;
    search?: string;
    page?: number;
    limit?: number;
  };
  const { page, limit, skip } = parsePagination(q);
  const result = await reservationService.listReservationsForAdmin({ ...q, page, limit, skip });
  return ok(res, result.rows.map(reservationDto), paginationMeta(result.total, page, limit));
}

export async function adminConfirm(req: Request, res: Response) {
  const reservation = await reservationService.confirmReservation(req.auth!.userId, req.params.id, clientIp(req));
  const full = await reservationService.getReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    reservation.id,
  );
  return ok(res, reservationDto(full));
}

export async function adminCancel(req: Request, res: Response) {
  const reservation = await reservationService.cancelReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
    clientIp(req),
    req.body?.reason ?? 'Dibatalkan oleh admin',
  );
  const full = await reservationService.getReservation(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    reservation.id,
  );
  return ok(res, reservationDto(full));
}
