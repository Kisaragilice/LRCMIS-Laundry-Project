import type { Request, Response } from 'express';
import * as maintenanceService from '../services/maintenance.service';
import { ok } from '../utils/http';

export async function historySummary(_req: Request, res: Response) {
  return ok(res, await maintenanceService.getHistorySummary());
}

export async function resetHistory(_req: Request, res: Response) {
  return ok(res, await maintenanceService.resetHistory());
}
