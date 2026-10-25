import type { Request, Response } from 'express';
import * as chatService from '../services/chat.service';
import { created, ok } from '../utils/http';

export async function listConversations(req: Request, res: Response) {
  const data = await chatService.listConversations(req.auth!);
  return ok(res, data);
}

export async function getMessages(req: Request, res: Response) {
  const data = await chatService.getMessages(req.auth!, req.params.id);
  return ok(res, data);
}

export async function sendMessage(req: Request, res: Response) {
  const data = await chatService.sendMessage(req.auth!, req.params.id, req.body.body);
  return created(res, data);
}

export async function startConversation(req: Request, res: Response) {
  const data = await chatService.startAdminConversation(req.auth!, req.body.userId);
  return created(res, data);
}

export async function startAdminThread(req: Request, res: Response) {
  const data = await chatService.startAdminThread(req.auth!);
  return created(res, data);
}

export async function listAdminContacts(req: Request, res: Response) {
  const data = await chatService.listAdminContacts(req.auth!);
  return ok(res, data);
}

export async function listDeliveryContacts(req: Request, res: Response) {
  const data = await chatService.listDeliveryContacts(req.auth!);
  return ok(res, data);
}

export async function startOrderThread(req: Request, res: Response) {
  const data = await chatService.startOrderThread(req.auth!, req.params.orderId);
  return created(res, data);
}
