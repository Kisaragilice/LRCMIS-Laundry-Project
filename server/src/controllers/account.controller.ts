import type { Request, Response } from 'express';
import * as accountService from '../services/account.service';
import { created, ok, paginationMeta, parsePagination } from '../utils/http';
import { clientIp } from '../services/audit.service';

export async function list(req: Request, res: Response) {
  const query = req.query as unknown as accountService.AccountFilters;
  const { page, limit, skip } = parsePagination(query);
  const result = await accountService.listAccounts({
    search: query.search,
    role: query.role,
    status: query.status,
    page,
    limit,
    skip,
  });
  return ok(res, result.data, paginationMeta(result.total, page, limit));
}

export async function create(req: Request, res: Response) {
  const account = await accountService.createInternalAccount(req.auth!.userId, req.body, clientIp(req));
  return created(res, account);
}

export async function setStatus(req: Request, res: Response) {
  const updated = await accountService.setAccountActive(
    req.auth!.userId,
    req.params.id,
    req.body.isActive,
    clientIp(req),
  );
  return ok(res, updated);
}

export async function remove(req: Request, res: Response) {
  const result = await accountService.deleteAccount(req.auth!.userId, req.params.id, clientIp(req));
  return ok(res, result);
}
