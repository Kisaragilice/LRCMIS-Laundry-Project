import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app';

export const prisma = new PrismaClient();
export const app = createApp();
export const PASSWORD = 'Password123';

export interface TestClient {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  user: { id: string; email: string; roles: string[] };
}

export const roleNames = ['customer', 'admin', 'staff', 'courier', 'owner'] as const;

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, notifications, chat_reads, chat_messages, chat_conversations,
      complaint_follow_ups, complaints, reviews,
      promotion_redemptions, payments, delivery_tasks, order_notes,
      order_status_history, order_items, orders, reservation_items, reservations,
      time_slots, addresses, password_reset_tokens, user_roles, users,
      services, promotions, roles
    RESTART IDENTITY CASCADE
  `);
}

export async function seedRoles() {
  const roles = new Map<string, string>();
  for (const name of roleNames) {
    const created = await prisma.role.create({
      data: {
        name,
        description: `Test role ${name}`,
      },
    });
    roles.set(name, created.id);
  }
  return roles;
}

export async function createUser(
  roles: Map<string, string>,
  input: { name: string; email: string; role: (typeof roleNames)[number]; phone?: string; isPrimaryAdmin?: boolean },
) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? '081234567890',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      isPrimaryAdmin: input.isPrimaryAdmin ?? false,
      roles: { create: { roleId: roles.get(input.role)! } },
    },
  });
}

export async function login(email: string, password = PASSWORD): Promise<TestClient> {
  const agent = request.agent(app);
  const response = await agent.post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    agent,
    csrf: response.body.data.csrfToken,
    user: response.body.data.user,
  };
}

export function client(clientRef: TestClient, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown) {
  let req = clientRef.agent[method](path).set('X-CSRF-Token', clientRef.csrf);
  if (body !== undefined) req = req.send(body as Record<string, unknown>);
  return req;
}

export const tomorrowIso = () => DateTime.now().setZone('Asia/Jakarta').plus({ days: 1 }).toISODate()!;
export const todayIso = () => DateTime.now().setZone('Asia/Jakarta').toISODate()!;

export async function createSlot(input: { dateIso: string; start: string; end: string; capacity: number }) {
  return prisma.timeSlot.create({
    data: {
      slotDate: new Date(`${input.dateIso}T00:00:00.000Z`),
      startTime: new Date(`1970-01-01T${input.start}:00.000Z`),
      endTime: new Date(`1970-01-01T${input.end}:00.000Z`),
      capacity: input.capacity,
      isAvailable: true,
    },
  });
}

/** Full customer -> confirmed reservation -> order flow through the public API. */
export async function createOrder(
  customer: TestClient,
  admin: TestClient,
  input: { slotId: string; serviceId: string; quantity?: number; pickupType?: 'drop_off' | 'pickup'; addressId?: string | null },
) {
  const reservationResponse = await client(customer, 'post', '/api/v1/reservations', {
    timeSlotId: input.slotId,
    pickupType: input.pickupType ?? 'drop_off',
    addressId: input.addressId ?? undefined,
    items: [{ serviceId: input.serviceId, quantity: input.quantity ?? 1 }],
  });
  if (reservationResponse.status !== 201) {
    throw new Error(`Reservation failed: ${reservationResponse.status} ${JSON.stringify(reservationResponse.body)}`);
  }
  const reservation = reservationResponse.body.data;
  const confirmed = await client(admin, 'patch', `/api/v1/admin/reservations/${reservation.id}/confirm`);
  if (confirmed.status !== 200) {
    throw new Error(`Confirm failed: ${confirmed.status} ${JSON.stringify(confirmed.body)}`);
  }
  const orderResponse = await client(admin, 'post', `/api/v1/admin/reservations/${reservation.id}/orders`, {});
  if (orderResponse.status !== 201) {
    throw new Error(`Order failed: ${orderResponse.status} ${JSON.stringify(orderResponse.body)}`);
  }
  return { reservation, order: orderResponse.body.data };
}
