import type { Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import { ok, paginationMeta, parsePagination } from '../utils/http';
import { paymentDto } from '../utils/serializers';
import { clientIp } from '../services/audit.service';
import { BadRequest } from '../utils/errors';

export async function listForOrder(req: Request, res: Response) {
  const payments = await paymentService.listPaymentsForOrder(
    { userId: req.auth!.userId, roles: req.auth!.roles },
    req.params.id,
  );
  return ok(res, payments.map(paymentDto));
}

export async function createForOrder(req: Request, res: Response) {
  const header = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(header) ? header[0] : header;
  if (!idempotencyKey) {
    throw BadRequest('Header Idempotency-Key wajib dikirim untuk mencegah pembayaran ganda', [
      { field: 'Idempotency-Key', message: 'Header ini wajib diisi' },
    ]);
  }
  const result = await paymentService.recordPayment(
    req.auth!.userId,
    req.params.id,
    req.body,
    idempotencyKey,
    clientIp(req),
  );
  const status = result.duplicate ? 200 : 201;
  return res.status(status).json({
    success: true,
    data: {
      payment: paymentDto(result.payment),
      duplicate: result.duplicate,
      orderPaymentStatus: result.order.paymentStatus,
    },
  });
}

export async function verify(req: Request, res: Response) {
  const result = await paymentService.verifyPayment(
    req.auth!.userId,
    req.params.id,
    req.body.notes ?? null,
    clientIp(req),
  );
  return ok(res, {
    payment: paymentDto(result.payment),
    orderPaymentStatus: result.orderPaymentStatus,
    paidAmount: result.paidAmount,
  });
}

export async function reject(req: Request, res: Response) {
  const result = await paymentService.rejectPayment(
    req.auth!.userId,
    req.params.id,
    req.body.reason,
    clientIp(req),
  );
  return ok(res, { payment: paymentDto(result.payment), orderPaymentStatus: result.orderPaymentStatus });
}

export async function refund(req: Request, res: Response) {
  const result = await paymentService.refundPayment(
    req.auth!.userId,
    req.params.id,
    req.body.reason,
    clientIp(req),
  );
  return ok(res, { payment: paymentDto(result.payment), orderPaymentStatus: result.orderPaymentStatus });
}

export async function myPayments(req: Request, res: Response) {
  const q = req.query as unknown as { status?: 'pending' | 'paid' | 'failed' | 'refunded'; page?: number; limit?: number };
  const { page, limit, skip } = parsePagination(q);
  const result = await paymentService.listPaymentsForCustomer(req.auth!.userId, { ...q, page, limit, skip });
  return ok(
    res,
    result.rows.map((payment) => ({
      ...paymentDto(payment),
      order: payment.order
        ? {
            id: payment.order.id,
            orderCode: payment.order.orderCode,
            orderStatus: payment.order.orderStatus,
            totalAmount: Number(payment.order.totalAmount),
            customer: payment.order.customer
              ? { id: payment.order.customer.id, name: payment.order.customer.name, email: payment.order.customer.email }
              : undefined,
          }
        : undefined,
    })),
    paginationMeta(result.total, page, limit),
  );
}

export async function adminList(req: Request, res: Response) {
  const q = req.query as unknown as {
    status?: 'pending' | 'paid' | 'failed' | 'refunded';
    method?: 'cash' | 'bank_transfer' | 'payment_gateway';
    search?: string;
    page?: number;
    limit?: number;
  };
  const { page, limit, skip } = parsePagination(q);
  const result = await paymentService.listPaymentsForAdmin({ ...q, page, limit, skip });
  return ok(
    res,
    result.rows.map((payment) => ({
      ...paymentDto(payment),
      order: payment.order
        ? {
            id: payment.order.id,
            orderCode: payment.order.orderCode,
            orderStatus: payment.order.orderStatus,
            totalAmount: Number(payment.order.totalAmount),
            customer: payment.order.customer
              ? { id: payment.order.customer.id, name: payment.order.customer.name, email: payment.order.customer.email }
              : undefined,
          }
        : undefined,
    })),
    paginationMeta(result.total, page, limit),
  );
}
