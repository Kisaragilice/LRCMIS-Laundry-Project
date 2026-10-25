import type { Request, Response } from 'express';
import * as feedbackService from '../services/feedback.service';
import { created, ok, paginationMeta, parsePagination } from '../utils/http';
import { clientIp } from '../services/audit.service';

export async function createReview(req: Request, res: Response) {
  const review = await feedbackService.createReview(
    req.auth!.userId,
    req.params.id,
    req.body,
    clientIp(req),
  );
  return created(res, review);
}

export async function featuredReviews(_req: Request, res: Response) {
  return ok(res, await feedbackService.listFeaturedReviews());
}

export async function adminReviews(req: Request, res: Response) {
  const q = req.query as unknown as { rating?: number; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const result = await feedbackService.listReviewsForAdmin({
    rating: q.rating ? Number(q.rating) : undefined,
    page,
    limit,
    skip,
  });
  return ok(
    res,
    { rows: result.rows, averageRating: result.averageRating, totalReviews: result.totalReviews },
    paginationMeta(result.total, page, limit),
  );
}

export async function createComplaint(req: Request, res: Response) {
  const complaint = await feedbackService.createComplaint(req.auth!.userId, req.body, clientIp(req));
  return created(res, complaint);
}

export async function createComplaintForOrder(req: Request, res: Response) {
  const complaint = await feedbackService.createComplaint(
    req.auth!.userId,
    { ...req.body, orderId: req.params.id },
    clientIp(req),
  );
  return created(res, complaint);
}

export async function myComplaints(req: Request, res: Response) {
  return ok(res, await feedbackService.listMyComplaints(req.auth!.userId));
}

export async function adminComplaints(req: Request, res: Response) {
  const q = req.query as unknown as { status?: string; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const result = await feedbackService.listComplaintsForAdmin({ ...q, page, limit, skip });
  return ok(res, result.rows, paginationMeta(result.total, page, limit));
}

export async function updateComplaint(req: Request, res: Response) {
  const complaint = await feedbackService.updateComplaint(
    req.auth!.userId,
    req.params.id,
    req.body,
    clientIp(req),
  );
  return ok(res, complaint);
}

export async function followUp(req: Request, res: Response) {
  const followUp = await feedbackService.addComplaintFollowUp(
    req.auth!.userId,
    req.params.id,
    req.body.note,
    clientIp(req),
  );
  return created(res, followUp);
}
