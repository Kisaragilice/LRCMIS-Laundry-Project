import type { Request, Response } from 'express';
import * as promotionService from '../services/promotion.service';
import { created, ok } from '../utils/http';
import { promotionDto } from '../utils/serializers';
import { clientIp } from '../services/audit.service';

export async function customerList(req: Request, res: Response) {
  const subtotal = req.query.subtotal ? Number(req.query.subtotal) : undefined;
  const data = await promotionService.listPromotionsForCustomer(req.auth!.userId, subtotal);
  return ok(res, data);
}

export async function validateVoucher(req: Request, res: Response) {
  const evaluation = await promotionService.previewPromotion(
    req.auth!.userId,
    req.body.code,
    req.body.subtotal,
  );
  return ok(res, {
    promotionId: evaluation.promotionId,
    code: evaluation.code,
    discountAmount: Number(evaluation.discountAmount),
    description: evaluation.description,
  });
}

export async function adminList(_req: Request, res: Response) {
  const promotions = await promotionService.listAllPromotions();
  return ok(res, promotions.map((promotion) => promotionDto(promotion, true)));
}

export async function createPromotion(req: Request, res: Response) {
  const promotion = await promotionService.createPromotion(req.auth!.userId, req.body, clientIp(req));
  return created(res, promotionDto(promotion));
}

export async function updatePromotion(req: Request, res: Response) {
  const promotion = await promotionService.updatePromotion(
    req.auth!.userId,
    req.params.id,
    req.body,
    clientIp(req),
  );
  return ok(res, promotionDto(promotion));
}
