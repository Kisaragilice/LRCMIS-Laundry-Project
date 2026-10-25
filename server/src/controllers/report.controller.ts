import type { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { getDashboard } from '../services/dashboard.service';
import { ok, paginationMeta, parsePagination } from '../utils/http';
import { clientIp, AUDIT, writeAudit } from '../services/audit.service';

export async function dashboard(req: Request, res: Response) {
  const data = await getDashboard(req.query as { from?: string; to?: string });
  return ok(res, data);
}

export async function revenue(req: Request, res: Response) {
  return ok(res, await reportService.getRevenueReport(req.query));
}

export async function orders(req: Request, res: Response) {
  return ok(res, await reportService.getOrderReport(req.query));
}

export async function services(req: Request, res: Response) {
  return ok(res, await reportService.getPopularServices(req.query));
}

export async function customers(req: Request, res: Response) {
  return ok(res, await reportService.getCustomerReport(req.query));
}

export async function operations(req: Request, res: Response) {
  return ok(res, await reportService.getOperationalReport(req.query));
}

export async function exportReport(req: Request, res: Response) {
  const query = req.query as unknown as { type: 'revenue' | 'orders' | 'services' | 'customers'; from?: string; to?: string };
  const result = await reportService.buildExport(query);
  await writeAudit({
    userId: req.auth!.userId,
    action: AUDIT.REPORT_EXPORTED,
    entityType: 'report',
    entityId: null,
    metadata: { type: query.type, from: query.from ?? null, to: query.to ?? null },
    ip: clientIp(req),
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  return res.status(200).send(result.csv);
}

export async function auditLogs(req: Request, res: Response) {
  const q = req.query as unknown as { action?: string; entityType?: string; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const result = await reportService.listAuditLogs({ ...q, page, limit, skip });
  return ok(res, result.rows, paginationMeta(result.total, page, limit));
}
