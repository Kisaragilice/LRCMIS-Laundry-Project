import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DateTime } from 'luxon';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  app,
  client,
  createOrder,
  createSlot,
  createUser,
  login,
  prisma,
  PASSWORD,
  resetDatabase,
  seedRoles,
  type TestClient,
  todayIso,
  tomorrowIso,
} from './helpers';

let roles: Map<string, string>;
let admin: TestClient;
let owner: TestClient;
let staff: TestClient;
let courier: TestClient;
let customerA: TestClient;
let customerB: TestClient;
let customerAId: string;
let customerBId: string;
let addressAId: string;
let slotMainId: string;
let slotRaceId: string;
let slotSnapshotId: string;
let kgServiceId: string;
let snapshotServiceId: string;

const loginEmails = {
  admin: 'admin@test.local',
  owner: 'owner@test.local',
  staff: 'staff@test.local',
  courier: 'courier@test.local',
  customerA: 'customer.a@test.local',
  customerB: 'customer.b@test.local',
};

beforeAll(async () => {
  await resetDatabase();
  roles = await seedRoles();

  const adminUser = await createUser(roles, { name: 'Admin Test', email: loginEmails.admin, role: 'admin' });
  await createUser(roles, { name: 'Owner Test', email: loginEmails.owner, role: 'owner' });
  await createUser(roles, { name: 'Staff Test', email: loginEmails.staff, role: 'staff' });
  await createUser(roles, { name: 'Courier Test', email: loginEmails.courier, role: 'courier' });
  const customerAUser = await createUser(roles, { name: 'Andi Pelanggan', email: loginEmails.customerA, role: 'customer' });
  const customerBUser = await createUser(roles, { name: 'Bella Pelanggan', email: loginEmails.customerB, role: 'customer' });
  customerAId = customerAUser.id;
  customerBId = customerBUser.id;
  expect(adminUser.email).toBe(loginEmails.admin);

  const address = await prisma.address.create({
    data: {
      userId: customerAId,
      label: 'Rumah',
      recipientName: 'Andi Pelanggan',
      phone: '081200000001',
      addressText: 'Jl. Untung Suropati No.67, Kota Bandar Lampung',
      isDefault: true,
    },
  });
  addressAId = address.id;

  const kgService = await prisma.service.create({
    data: { name: 'Cuci Kering Test', price: 10_000, pricingUnit: 'kg', estimatedHours: 24 },
  });
  kgServiceId = kgService.id;
  const snapshotService = await prisma.service.create({
    data: { name: 'Cuci Snapshot Test', price: 12_000, pricingUnit: 'kg', estimatedHours: 24 },
  });
  snapshotServiceId = snapshotService.id;

  const mainSlot = await createSlot({ dateIso: tomorrowIso(), start: '09:00', end: '10:00', capacity: 50 });
  slotMainId = mainSlot.id;
  const raceSlot = await createSlot({ dateIso: tomorrowIso(), start: '11:00', end: '12:00', capacity: 1 });
  slotRaceId = raceSlot.id;
  const snapshotSlot = await createSlot({ dateIso: tomorrowIso(), start: '13:00', end: '14:00', capacity: 10 });
  slotSnapshotId = snapshotSlot.id;

  const now = Date.now();
  await prisma.promotion.create({
    data: {
      code: 'EXPIRED10',
      discountType: 'percentage',
      discountValue: 10,
      minPurchase: 0,
      perUserLimit: 1,
      startAt: new Date(now - 5 * 86_400_000),
      endAt: new Date(now - 86_400_000),
      isActive: true,
    },
  });
  await prisma.promotion.create({
    data: {
      code: 'HEMAT10',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscount: 10_000,
      minPurchase: 20_000,
      perUserLimit: 1,
      startAt: new Date(now - 86_400_000),
      endAt: new Date(now + 30 * 86_400_000),
      isActive: true,
    },
  });

  admin = await login(loginEmails.admin);
  owner = await login(loginEmails.owner);
  staff = await login(loginEmails.staff);
  courier = await login(loginEmails.courier);
  customerA = await login(loginEmails.customerA);
  customerB = await login(loginEmails.customerB);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('authentication and authorization', () => {
  it('rejects a wrong password and does not leak the hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: loginEmails.customerA, password: 'WrongPassword123' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/v1/orders/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('blocks customers from admin endpoints', async () => {
    const response = await client(customerA, 'get', '/api/v1/admin/orders');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows owner read-only analytics but blocks owner administrative writes', async () => {
    const dashboard = await client(owner, 'get', '/api/v1/admin/dashboard');
    expect(dashboard.status).toBe(200);

    const write = await client(owner, 'post', '/api/v1/admin/promotions', {
      code: 'OWNER10',
      discountType: 'fixed',
      discountValue: 5000,
      minPurchase: 0,
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(write.status).toBe(403);
  });

  it('validates reservation payloads with field-level details', async () => {
    const response = await client(customerA, 'post', '/api/v1/reservations', {
      timeSlotId: slotMainId,
      pickupType: 'drop_off',
      items: [],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.some((detail: { field: string }) => detail.field === 'items')).toBe(true);
  });

  it('returns a generic forgot-password response without exposing the reset token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const unknown = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'tidak.terdaftar@test.local' });
      expect(unknown.status).toBe(200);
      expect(unknown.body.data.token).toBeNull();
      expect(unknown.body.data.message).toContain('Jika email terdaftar');

      const known = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: loginEmails.customerB });
      expect(known.status).toBe(200);
      expect(known.body.data.token).toBeNull();
      expect(known.body.data.expiresAt).toBeUndefined();
      expect(JSON.stringify(known.body)).not.toContain('tokenHash');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('accepts a valid reset token once and rejects reuse', async () => {
    const resetUser = await createUser(roles, {
      name: 'Reset User',
      email: 'reset.user@test.local',
      role: 'customer',
    });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: resetUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'PasswordBaru123' });
    expect(reset.status).toBe(200);

    const relogin = await login(resetUser.email, 'PasswordBaru123');
    expect(relogin.user.id).toBe(resetUser.id);

    const reused = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'PasswordLain123' });
    expect(reused.status).toBe(400);
    expect(reused.body.error.details?.[0]?.field).toBe('token');
  });
});

describe('ownership and privacy', () => {
  it('prevents one customer from reading another customer order', async () => {
    const { order } = await createOrder(customerA, admin, { slotId: slotMainId, serviceId: kgServiceId });

    const own = await client(customerA, 'get', `/api/v1/orders/${order.id}`);
    expect(own.status).toBe(200);

    const other = await client(customerB, 'get', `/api/v1/orders/${order.id}`);
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('FORBIDDEN');

    const payments = await client(customerB, 'get', `/api/v1/orders/${order.id}/payments`);
    expect(payments.status).toBe(404);

    expect(customerAId).not.toBe(customerBId);
    expect(addressAId).toBeTruthy();
  });

  it('hides other customers payment history from /payments/me', async () => {
    const response = await client(customerB, 'get', '/api/v1/payments/me');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('includes the review list in the admin customer detail response', async () => {
    const { order } = await createOrder(customerA, admin, { slotId: slotMainId, serviceId: kgServiceId });
    const review = await prisma.review.create({
      data: { orderId: order.id, userId: customerAId, rating: 5, comment: 'Wanginya tahan lama' },
    });

    const response = await client(admin, 'get', `/api/v1/admin/customers/${customerAId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.reviews).toEqual([
      {
        id: review.id,
        rating: 5,
        comment: 'Wanginya tahan lama',
        createdAt: expect.any(String),
      },
    ]);
  });
});

describe('concurrency-safe reservation capacity', () => {
  it('never overbooks the last seat when two customers reserve simultaneously', async () => {
    const [first, second] = await Promise.all([
      client(customerA, 'post', '/api/v1/reservations', {
        timeSlotId: slotRaceId,
        pickupType: 'drop_off',
        items: [{ serviceId: kgServiceId, quantity: 1 }],
      }),
      client(customerB, 'post', '/api/v1/reservations', {
        timeSlotId: slotRaceId,
        pickupType: 'drop_off',
        items: [{ serviceId: kgServiceId, quantity: 1 }],
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.body.error.code).toBe('SLOT_FULL');

    const active = await prisma.reservation.count({
      where: { timeSlotId: slotRaceId, status: { in: ['pending', 'confirmed'] } },
    });
    expect(active).toBe(1);
  });
});

describe('price snapshots and order workflow', () => {
  it('uses the price snapshot taken when the order was created, not the live service price', async () => {
    const { order } = await createOrder(customerA, admin, {
      slotId: slotSnapshotId,
      serviceId: snapshotServiceId,
      quantity: 2,
    });

    expect(order.items[0].price).toBe(12_000);

    await prisma.service.update({ where: { id: snapshotServiceId }, data: { price: 99_999 } });

    const received = await client(admin, 'post', `/api/v1/admin/orders/${order.id}/receive`, {
      actualWeight: 3.2,
    });

    expect(received.status).toBe(200);
    expect(received.body.data.actualWeight).toBe(3.5);
    expect(received.body.data.subtotal).toBe(42_000);
    expect(received.body.data.items[0].price).toBe(12_000);
    expect(received.body.data.orderStatus).toBe('received');

    const item = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    expect(Number(item?.priceSnapshot)).toBe(12_000);
  });

  it('rejects invalid order status transitions', async () => {
    const { order } = await createOrder(customerA, admin, { slotId: slotMainId, serviceId: kgServiceId });
    const invalid = await client(admin, 'patch', `/api/v1/admin/orders/${order.id}/status`, {
      status: 'completed',
    });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('prevents staff from modifying an order that is not assigned to them', async () => {
    const { order } = await createOrder(customerA, admin, { slotId: slotMainId, serviceId: kgServiceId });
    const response = await client(staff, 'patch', `/api/v1/staff/orders/${order.id}/status`, { status: 'cancelled' });
    expect(response.status).toBe(403);
  });
});

describe('payments, idempotency and reports', () => {
  let paidOrderId: string;
  const idempotencyKey = `test-idem-${randomUUID()}`;

  beforeAll(async () => {
    const { order } = await createOrder(customerA, admin, {
      slotId: slotSnapshotId,
      serviceId: kgServiceId,
    });
    const received = await client(admin, 'post', `/api/v1/admin/orders/${order.id}/receive`, {
      actualWeight: 3.2,
    });
    expect(received.status).toBe(200);
    paidOrderId = order.id;
  });

  it('records a cash payment once and treats a retry as idempotent', async () => {
    const payload = { amount: 35_000, method: 'cash', notes: 'Pembayaran uji' };

    const first = await client(admin, 'post', `/api/v1/admin/orders/${paidOrderId}/payments`, payload).set(
      'Idempotency-Key',
      idempotencyKey,
    );
    expect(first.status).toBe(201);
    expect(first.body.data.duplicate).toBe(false);
    expect(first.body.data.orderPaymentStatus).toBe('paid');

    const second = await client(admin, 'post', `/api/v1/admin/orders/${paidOrderId}/payments`, payload).set(
      'Idempotency-Key',
      idempotencyKey,
    );
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.payment.id).toBe(first.body.data.payment.id);

    const payments = await prisma.payment.findMany({ where: { orderId: paidOrderId } });
    expect(payments).toHaveLength(1);
    expect(Number(payments[0].amount)).toBe(35_000);
  });

  it('requires an Idempotency-Key header', async () => {
    const response = await client(admin, 'post', `/api/v1/admin/orders/${paidOrderId}/payments`, {
      amount: 1000,
      method: 'cash',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Idempotency-Key');
  });

  it('reports revenue for the requested period', async () => {
    const today = todayIso();
    const response = await client(admin, 'get', `/api/v1/admin/reports/revenue?from=${today}&to=${today}&groupBy=day`);
    expect(response.status).toBe(200);
    expect(response.body.data.period.from).toBe(today);
    expect(response.body.data.summary.grossRevenue).toBeGreaterThanOrEqual(35_000);
    expect(response.body.data.summary.netRevenue).toBeGreaterThanOrEqual(35_000);
    expect(response.body.data.series.some((row: { period: string }) => row.period === today)).toBe(true);
    expect(response.body.data.paymentMethods.some((row: { method: string }) => row.method === 'cash')).toBe(true);
  });

  it('exports a CSV report with the expected content type', async () => {
    const today = todayIso();
    const response = await client(admin, 'get', `/api/v1/admin/reports/export?type=revenue&from=${today}&to=${today}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('laporan-pendapatan');
    expect(response.text).toContain('Tanggal');
  });

  it('returns empty report structures for periods without data', async () => {
    const response = await client(admin, 'get', '/api/v1/admin/reports/revenue?from=2035-01-01&to=2035-01-02');
    expect(response.status).toBe(200);
    expect(response.body.data.empty).toBe(true);
    expect(response.body.data.summary.grossRevenue).toBe(0);
    expect(response.body.data.series).toHaveLength(2);
  });
});

describe('vouchers and empty states', () => {
  it('rejects an expired voucher', async () => {
    const response = await client(customerA, 'post', '/api/v1/promotions/validate', {
      code: 'EXPIRED10',
      subtotal: 50_000,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message.toLowerCase()).toContain('kedaluwarsa');
  });

  it('evaluates a valid voucher with a maximum discount cap', async () => {
    const response = await client(customerA, 'post', '/api/v1/promotions/validate', {
      code: 'HEMAT10',
      subtotal: 500_000,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.discountAmount).toBe(10_000);
  });

  it('rejects voucher use below the minimum purchase', async () => {
    const response = await client(customerA, 'post', '/api/v1/promotions/validate', {
      code: 'HEMAT10',
      subtotal: 10_000,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message.toLowerCase()).toContain('minimum');
  });

  it('returns an empty page instead of an error when filters match nothing', async () => {
    const response = await client(admin, 'get', '/api/v1/admin/customers?search=no-such-customer-xyz');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });
});

describe('role-specific dashboards', () => {
  it('serves courier tasks only for the logged-in courier', async () => {
    const response = await client(courier, 'get', '/api/v1/courier/tasks');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    for (const task of response.body.data) {
      expect(task.courier.id).toBe(courier.user.id);
    }
  });

  it('serves staff production orders only for assigned staff', async () => {
    const response = await client(staff, 'get', '/api/v1/staff/orders');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('returns audit logs for admin only', async () => {
    const forbidden = await client(customerA, 'get', '/api/v1/admin/audit-logs');
    expect(forbidden.status).toBe(403);

    const response = await client(admin, 'get', '/api/v1/admin/audit-logs?limit=5');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].action).toBeTruthy();
  });
});

describe('timezone helpers', () => {
  it('uses Asia/Jakarta dates for the report period', () => {
    const jakartaToday = DateTime.now().setZone('Asia/Jakarta').toISODate();
    expect(todayIso()).toBe(jakartaToday);
  });
});

describe('operational chat', () => {
  let customerConversationId: string;
  let staffConversationId: string;
  let courierConversationId: string;
  let deliveryConversationId: string;
  let deliveringOrderId: string;

  beforeAll(async () => {
    const customerThread = await client(admin, 'post', '/api/v1/chat/conversations', { userId: customerAId });
    expect(customerThread.status).toBe(201);
    customerConversationId = customerThread.body.data.id;
    expect(customerThread.body.data.type).toBe('admin_customer');

    const staffThread = await client(staff, 'post', '/api/v1/chat/admin-thread');
    expect(staffThread.status).toBe(201);
    staffConversationId = staffThread.body.data.id;
    expect(staffThread.body.data.type).toBe('admin_staff');

    const courierThread = await client(courier, 'post', '/api/v1/chat/admin-thread');
    expect(courierThread.status).toBe(201);
    courierConversationId = courierThread.body.data.id;
    expect(courierThread.body.data.type).toBe('admin_courier');

    const { order } = await createOrder(customerA, admin, {
      slotId: slotMainId,
      serviceId: kgServiceId,
      pickupType: 'pickup',
      addressId: addressAId,
    });
    deliveringOrderId = order.id;
    await prisma.deliveryTask.create({
      data: {
        orderId: order.id,
        courierId: courier.user.id,
        taskType: 'delivery',
        status: 'in_progress',
        scheduledAt: new Date(),
        addressSnapshot: 'Jl. Untung Suropati No.67, Kota Bandar Lampung',
        contactPhone: '089634204779',
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { orderStatus: 'delivering' } });
  });

  it('lets admin message a customer and preserves the thread for the customer', async () => {
    const sent = await client(admin, 'post', `/api/v1/chat/conversations/${customerConversationId}/messages`, {
      body: 'Halo, ada yang bisa kami bantu?',
    });
    expect(sent.status).toBe(201);

    const customerList = await client(customerA, 'get', '/api/v1/chat/conversations');
    expect(customerList.status).toBe(200);
    const thread = customerList.body.data.find((row: { id: string }) => row.id === customerConversationId);
    expect(thread).toBeTruthy();
    expect(thread.unread).toBe(1);

    const reply = await client(customerA, 'post', `/api/v1/chat/conversations/${customerConversationId}/messages`, {
      body: 'Pesanan saya kapan siap?',
    });
    expect(reply.status).toBe(201);

    const adminList = await client(admin, 'get', '/api/v1/chat/conversations');
    const adminThread = adminList.body.data.find((row: { id: string }) => row.id === customerConversationId);
    expect(adminThread.unread).toBe(1);

    const messages = await client(admin, 'get', `/api/v1/chat/conversations/${customerConversationId}/messages`);
    expect(messages.status).toBe(200);
    expect(messages.body.data.messages.map((message: { body: string }) => message.body)).toEqual([
      'Halo, ada yang bisa kami bantu?',
      'Pesanan saya kapan siap?',
    ]);
    expect(messages.body.data.conversation.unread).toBe(0);

    const readList = await client(admin, 'get', '/api/v1/chat/conversations');
    const readThread = readList.body.data.find((row: { id: string }) => row.id === customerConversationId);
    expect(readThread.unread).toBe(0);
  });

  it('supports admin threads for staff and courier with role-aware access', async () => {
    const staffMessage = await client(staff, 'post', `/api/v1/chat/conversations/${staffConversationId}/messages`, {
      body: 'Stok deterjen perlu ditambah.',
    });
    expect(staffMessage.status).toBe(201);
    const courierMessage = await client(courier, 'post', `/api/v1/chat/conversations/${courierConversationId}/messages`, {
      body: 'Saya sudah sampai di lokasi pelanggan.',
    });
    expect(courierMessage.status).toBe(201);

    const adminStaffMessages = await client(admin, 'get', `/api/v1/chat/conversations/${staffConversationId}/messages`);
    expect(adminStaffMessages.status).toBe(200);
    expect(adminStaffMessages.body.data.messages[0].body).toBe('Stok deterjen perlu ditambah.');

    const adminCourierMessages = await client(admin, 'get', `/api/v1/chat/conversations/${courierConversationId}/messages`);
    expect(adminCourierMessages.status).toBe(200);
    expect(adminCourierMessages.body.data.messages[0].body).toBe('Saya sudah sampai di lokasi pelanggan.');

    const staffSendsToCustomer = await client(staff, 'get', `/api/v1/chat/conversations/${customerConversationId}/messages`);
    expect(staffSendsToCustomer.status).toBe(404);

    const ownerList = await client(owner, 'get', '/api/v1/chat/conversations');
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data).toEqual([]);

    const ownerStart = await client(owner, 'post', '/api/v1/chat/admin-thread');
    expect(ownerStart.status).toBe(403);

    const contacts = await client(admin, 'get', '/api/v1/chat/contacts');
    expect(contacts.status).toBe(200);
    expect(contacts.body.data.some((contact: { id: string }) => contact.id === customerAId)).toBe(true);
    expect(contacts.body.data.some((contact: { id: string }) => contact.id === courier.user.id)).toBe(true);
  });

  it('opens courier-customer chat only for an assigned courier and an actively delivering order', async () => {
    const before = await client(courier, 'get', '/api/v1/chat/delivery-contacts');
    expect(before.status).toBe(200);
    expect(before.body.data.some((row: { orderId: string }) => row.orderId === deliveringOrderId)).toBe(true);

    const started = await client(courier, 'post', `/api/v1/chat/orders/${deliveringOrderId}/thread`);
    expect(started.status).toBe(201);
    deliveryConversationId = started.body.data.id;
    expect(started.body.data.type).toBe('courier_customer');

    const wrongCustomer = await client(customerB, 'post', `/api/v1/chat/orders/${deliveringOrderId}/thread`);
    expect(wrongCustomer.status).toBe(403);

    const wrongCourier = await client(staff, 'post', `/api/v1/chat/orders/${deliveringOrderId}/thread`);
    expect(wrongCourier.status).toBe(403);

    const courierMessage = await client(courier, 'post', `/api/v1/chat/conversations/${deliveryConversationId}/messages`, {
      body: 'Paket sedang menuju alamat Anda.',
    });
    expect(courierMessage.status).toBe(201);

    const customerMessages = await client(customerA, 'get', `/api/v1/chat/conversations/${deliveryConversationId}/messages`);
    expect(customerMessages.status).toBe(200);
    expect(customerMessages.body.data.messages[0].body).toBe('Paket sedang menuju alamat Anda.');

    const adminDenied = await client(admin, 'get', `/api/v1/chat/conversations/${deliveryConversationId}/messages`);
    expect(adminDenied.status).toBe(404);

    await prisma.order.update({ where: { id: deliveringOrderId }, data: { orderStatus: 'completed' } });

    const afterDelivery = await client(customerA, 'post', `/api/v1/chat/conversations/${deliveryConversationId}/messages`, {
      body: 'Terima kasih.',
    });
    expect(afterDelivery.status).toBe(409);
    expect(afterDelivery.body.error.code).toBe('CHAT_DELIVERY_INACTIVE');

    const historyStillReadable = await client(customerA, 'get', `/api/v1/chat/conversations/${deliveryConversationId}/messages`);
    expect(historyStillReadable.status).toBe(200);
    expect(historyStillReadable.body.data.conversation.canSend).toBe(false);
  });
});

describe('account management and primary admin protection', () => {
  let primaryAdmin: TestClient;
  let secondAdmin: TestClient;
  let ordinaryCustomer: TestClient;
  let ordinaryCustomerId: string;
  let preservedOrderId: string;
  let primaryAdminId: string;
  let secondAdminId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);
    const primaryUser = await createUser(roles, {
      name: 'Primary Administrator',
      email: `primary.${suffix}@test.local`,
      role: 'admin',
      isPrimaryAdmin: true,
    });
    const secondAdminUser = await createUser(roles, {
      name: 'Second Admin',
      email: `second.admin.${suffix}@test.local`,
      role: 'admin',
    });
    const ordinaryUser = await createUser(roles, {
      name: 'Deletable Customer',
      email: `deletable.${suffix}@test.local`,
      role: 'customer',
    });

    primaryAdminId = primaryUser.id;
    secondAdminId = secondAdminUser.id;
    ordinaryCustomerId = ordinaryUser.id;

    primaryAdmin = await login(primaryUser.email);
    secondAdmin = await login(secondAdminUser.email);
    ordinaryCustomer = await login(ordinaryUser.email);

    const created = await createOrder(ordinaryCustomer, secondAdmin, {
      slotId: slotMainId,
      serviceId: kgServiceId,
    });
    preservedOrderId = created.order.id;
  });

  it('lists accounts for admins and exposes the primary designation', async () => {
    const response = await client(secondAdmin, 'get', '/api/v1/admin/accounts?limit=100');
    expect(response.status).toBe(200);
    const primary = response.body.data.find((account: { id: string }) => account.id === primaryAdminId);
    expect(primary.isPrimaryAdmin).toBe(true);
    expect(primary.email).toContain('primary.');
  });

  it('creates staff, courier and owner accounts that can log in', async () => {
    const suffix = randomUUID().slice(0, 8);
    const emails: Record<string, string> = {};

    for (const role of ['staff', 'courier', 'owner'] as const) {
      const email = `created.${role}.${suffix}@test.local`;
      emails[role] = email;
      const response = await client(secondAdmin, 'post', '/api/v1/admin/accounts', {
        name: `Akun ${role}`,
        email,
        password: 'Password123',
        phone: '081234567890',
        role,
      });
      expect(response.status).toBe(201);
      expect(response.body.data.roles).toEqual([role]);
      expect(response.body.data.isActive).toBe(true);

      const session = await login(email, 'Password123');
      const me = await client(session, 'get', '/api/v1/users/me');
      expect(me.status).toBe(200);
      expect(me.body.data.roles).toEqual([role]);
    }

    const duplicate = await client(secondAdmin, 'post', '/api/v1/admin/accounts', {
      name: 'Duplikat',
      email: emails.staff,
      password: 'Password123',
      role: 'staff',
    });
    expect(duplicate.status).toBe(409);

    const forbiddenRole = await client(secondAdmin, 'post', '/api/v1/admin/accounts', {
      name: 'Admin Baru',
      email: `created.admin.${suffix}@test.local`,
      password: 'Password123',
      role: 'admin',
    });
    expect(forbiddenRole.status).toBe(400);

    const customerDenied = await client(customerA, 'post', '/api/v1/admin/accounts', {
      name: 'Tidak Boleh',
      email: `created.denied.${suffix}@test.local`,
      password: 'Password123',
      role: 'staff',
    });
    expect(customerDenied.status).toBe(403);
  });

  it('denies account management to ordinary customers and owners', async () => {
    const customerList = await client(customerA, 'get', '/api/v1/admin/accounts');
    expect(customerList.status).toBe(403);
    const customerDelete = await client(customerA, 'delete', `/api/v1/admin/accounts/${secondAdminId}`);
    expect(customerDelete.status).toBe(403);
    const ownerList = await client(owner, 'get', '/api/v1/admin/accounts');
    expect(ownerList.status).toBe(403);
  });

  it('cannot delete or deactivate the primary administrator through the API', async () => {
    const deletion = await client(secondAdmin, 'delete', `/api/v1/admin/accounts/${primaryAdminId}`);
    expect(deletion.status).toBe(403);
    expect(deletion.body.error.message.toLowerCase()).toContain('administrator utama');

    const deactivation = await client(secondAdmin, 'patch', `/api/v1/admin/accounts/${primaryAdminId}/status`, { isActive: false });
    expect(deactivation.status).toBe(403);
    expect(deactivation.body.error.message.toLowerCase()).toContain('administrator utama');

    const selfDeletion = await client(primaryAdmin, 'delete', `/api/v1/admin/accounts/${primaryAdminId}`);
    expect(selfDeletion.status).toBe(403);

    const persisted = await prisma.user.findUnique({ where: { id: primaryAdminId } });
    expect(persisted?.isPrimaryAdmin).toBe(true);
    expect(persisted?.isActive).toBe(true);
    expect(persisted?.deletedAt).toBeNull();
  });

  it('enforces primary-admin protection at the database level', async () => {
    await expect(
      prisma.user.update({ where: { id: primaryAdminId }, data: { isPrimaryAdmin: false } }),
    ).rejects.toThrow();
    await expect(
      prisma.user.update({ where: { id: primaryAdminId }, data: { isActive: false } }),
    ).rejects.toThrow();
    await expect(prisma.user.delete({ where: { id: primaryAdminId } })).rejects.toThrow();
    await expect(
      prisma.user.create({
        data: {
          name: 'Duplicate Primary',
          email: `duplicate.${randomUUID().slice(0, 8)}@test.local`,
          passwordHash: 'not-used',
          isPrimaryAdmin: true,
        },
      }),
    ).rejects.toThrow();
  });

  it('cannot promote an ordinary admin or demote the primary admin via profile updates', async () => {
    const promote = await client(secondAdmin, 'patch', '/api/v1/users/me', { name: 'Second Admin', isPrimaryAdmin: true });
    expect(promote.status).toBe(200);
    const promoted = await prisma.user.findUnique({ where: { id: secondAdminId } });
    expect(promoted?.isPrimaryAdmin).toBe(false);

    const demote = await client(primaryAdmin, 'patch', '/api/v1/users/me', { name: 'Primary Administrator', isPrimaryAdmin: false });
    expect(demote.status).toBe(200);
    const persisted = await prisma.user.findUnique({ where: { id: primaryAdminId } });
    expect(persisted?.isPrimaryAdmin).toBe(true);
  });

  it('blocks self deletion and handles missing/invalid accounts', async () => {
    const selfDelete = await client(secondAdmin, 'delete', `/api/v1/admin/accounts/${secondAdminId}`);
    expect(selfDelete.status).toBe(400);

    const missing = await client(secondAdmin, 'delete', `/api/v1/admin/accounts/${randomUUID()}`);
    expect(missing.status).toBe(404);

    const invalid = await client(secondAdmin, 'delete', '/api/v1/admin/accounts/not-a-uuid');
    expect(invalid.status).toBe(400);
  });

  it('soft-deletes an eligible account, preserves history and invalidates authentication', async () => {
    const deletion = await client(secondAdmin, 'delete', `/api/v1/admin/accounts/${ordinaryCustomerId}`);
    expect(deletion.status).toBe(200);
    expect(deletion.body.data.deletedAt).toBeTruthy();

    const persisted = await prisma.user.findUnique({ where: { id: ordinaryCustomerId } });
    expect(persisted?.isActive).toBe(false);
    expect(persisted?.deletedAt).toBeTruthy();
    expect(persisted?.deletedBy).toBe(secondAdminId);

    const order = await prisma.order.findUnique({ where: { id: preservedOrderId } });
    expect(order?.customerId).toBe(ordinaryCustomerId);

    const loginAttempt = await request(app).post('/api/v1/auth/login').send({
      email: ordinaryCustomer.user.email,
      password: PASSWORD,
    });
    expect(loginAttempt.status).toBe(401);

    const sessionAttempt = await client(ordinaryCustomer, 'get', '/api/v1/users/me');
    expect(sessionAttempt.status).toBe(401);

    const repeat = await client(secondAdmin, 'delete', `/api/v1/admin/accounts/${ordinaryCustomerId}`);
    expect(repeat.status).toBe(400);
  });

  it('invalidates sessions when an account is deactivated', async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createUser(roles, {
      name: 'Session Customer',
      email: `session.${suffix}@test.local`,
      role: 'customer',
    });
    const session = await login(user.email);
    const deactivation = await client(secondAdmin, 'patch', `/api/v1/admin/accounts/${user.id}/status`, { isActive: false });
    expect(deactivation.status).toBe(200);
    const me = await client(session, 'get', '/api/v1/users/me');
    expect(me.status).toBe(401);
  });

  it('serialises concurrent deletions so only one request succeeds', async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await createUser(roles, {
      name: 'Race Customer',
      email: `race.${suffix}@test.local`,
      role: 'customer',
    });
    const [first, second] = await Promise.all([
      client(secondAdmin, 'delete', `/api/v1/admin/accounts/${user.id}`),
      client(secondAdmin, 'delete', `/api/v1/admin/accounts/${user.id}`),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);
  });

  it('clears transaction history while preserving accounts and master data', async () => {
    const customerDenied = await client(customerA, 'get', '/api/v1/admin/maintenance/history-summary');
    expect(customerDenied.status).toBe(403);

    const ownerDenied = await client(owner, 'post', '/api/v1/admin/maintenance/reset-history', {
      confirmation: 'HAPUS RIWAYAT',
    });
    expect(ownerDenied.status).toBe(403);

    const invalidConfirmation = await client(secondAdmin, 'post', '/api/v1/admin/maintenance/reset-history', {
      confirmation: 'hapus',
    });
    expect(invalidConfirmation.status).toBe(400);

    const before = await client(secondAdmin, 'get', '/api/v1/admin/maintenance/history-summary');
    expect(before.status).toBe(200);
    expect(before.body.data.reservations).toBeGreaterThan(0);
    expect(before.body.data.orders).toBeGreaterThan(0);
    expect(before.body.data.chatConversations).toBeGreaterThan(0);
    expect(before.body.data.auditLogs).toBeGreaterThan(0);

    const reset = await client(secondAdmin, 'post', '/api/v1/admin/maintenance/reset-history', {
      confirmation: 'HAPUS RIWAYAT',
    });
    expect(reset.status).toBe(200);
    expect(reset.body.data.orders).toBe(before.body.data.orders);

    const counts = await Promise.all([
      prisma.reservation.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.deliveryTask.count(),
      prisma.review.count(),
      prisma.complaint.count(),
      prisma.notification.count(),
      prisma.chatConversation.count(),
      prisma.auditLog.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const preserved = await Promise.all([
      prisma.user.count(),
      prisma.address.count(),
      prisma.service.count(),
      prisma.timeSlot.count(),
      prisma.promotion.count(),
    ]);
    expect(preserved.every((count) => count > 0)).toBe(true);

    const stillAuthenticated = await client(primaryAdmin, 'get', '/api/v1/users/me');
    expect(stillAuthenticated.status).toBe(200);
    expect(stillAuthenticated.body.data.isPrimaryAdmin).toBe(true);
  });
});
