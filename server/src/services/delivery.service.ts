import { Prisma, type TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ROLES } from '../config/constants';
import { Conflict, Forbidden, NotFound } from '../utils/errors';
import { AUDIT, writeAudit } from './audit.service';
import { notify } from './notification.service';

type Actor = { userId: string; roles: string[] };

const taskInclude = {
  courier: true,
  order: {
    include: {
      customer: true,
      reservation: { include: { address: true, timeSlot: true } },
    },
  },
} satisfies Prisma.DeliveryTaskInclude;

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  assigned: ['accepted', 'failed'],
  accepted: ['in_progress', 'failed'],
  in_progress: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export async function listCourierTasks(courierId: string) {
  return prisma.deliveryTask.findMany({
    where: { courierId },
    include: taskInclude,
    orderBy: [{ scheduledAt: 'asc' }],
    take: 100,
  });
}

export async function getCourierTask(actor: Actor, taskId: string) {
  const task = await prisma.deliveryTask.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) throw NotFound('Tugas tidak ditemukan');
  if (actor.roles.includes(ROLES.COURIER) && task.courierId !== actor.userId) {
    throw Forbidden('Tugas ini bukan milik Anda');
  }
  return task;
}

export async function updateTaskStatus(
  actor: Actor,
  taskId: string,
  input: { status: Exclude<TaskStatus, 'assigned'>; notes?: string | null; handoverRecipient?: string | null },
  ip?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "delivery_tasks" WHERE id = ${taskId}::uuid FOR UPDATE`;
    const task = await tx.deliveryTask.findUnique({
      where: { id: taskId },
      include: { order: { include: { customer: true } } },
    });
    if (!task) throw NotFound('Tugas tidak ditemukan');
    const isCourier = actor.roles.includes(ROLES.COURIER);
    if (isCourier && task.courierId !== actor.userId) throw Forbidden('Tugas ini bukan milik Anda');
    if (!task.courierId) throw Conflict('Tugas belum memiliki kurir', 'TASK_UNASSIGNED');
    if (!TASK_TRANSITIONS[task.status].includes(input.status)) {
      throw Conflict(`Transisi tugas dari ${task.status} ke ${input.status} tidak diizinkan`, 'INVALID_TASK_TRANSITION');
    }

    const now = new Date();
    const updated = await tx.deliveryTask.update({
      where: { id: taskId },
      data: {
        status: input.status,
        notes: input.notes ?? task.notes,
        ...(input.status === 'completed'
          ? {
              completedAt: now,
              handoverRecipient: input.handoverRecipient ?? null,
              handoverConfirmedAt: now,
            }
          : {}),
      },
      include: taskInclude,
    });

    // Order side-effects are written in the same database transaction, by trusted logic.
    let orderStatusChanged = false;
    if (task.taskType === 'delivery' && input.status === 'in_progress' && task.order.orderStatus === 'ready') {
      await tx.order.update({ where: { id: task.orderId }, data: { orderStatus: 'delivering' } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: task.orderId,
          oldStatus: 'ready',
          newStatus: 'delivering',
          changedBy: actor.userId,
          notes: 'Kurir sedang menuju lokasi pelanggan',
        },
      });
      orderStatusChanged = true;
    }
    if (task.taskType === 'delivery' && input.status === 'completed') {
      const order = await tx.order.findUnique({ where: { id: task.orderId } });
      if (order && order.orderStatus === 'delivering' && order.paymentStatus === 'paid') {
        await tx.order.update({
          where: { id: task.orderId },
          data: { orderStatus: 'completed', completedAt: now },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: task.orderId,
            oldStatus: 'delivering',
            newStatus: 'completed',
            changedBy: actor.userId,
            notes: 'Pengantaran selesai dan diterima pelanggan',
          },
        });
        orderStatusChanged = true;
      }
    }

    await writeAudit(
      {
        userId: actor.userId,
        action: AUDIT.DELIVERY_TASK_STATUS,
        entityType: 'delivery_task',
        entityId: taskId,
        metadata: {
          orderId: task.orderId,
          oldStatus: task.status,
          newStatus: input.status,
          handoverRecipient: input.handoverRecipient ?? null,
          orderStatusChanged,
        },
        ip,
      },
      tx,
    );
    await notify({
      userId: task.order.customerId,
      orderId: task.orderId,
      title:
        input.status === 'completed'
          ? 'Pesanan telah diantar'
          : input.status === 'in_progress'
            ? 'Kurir sedang menuju lokasi'
            : 'Pembaruan pengantaran',
      message: `Tugas ${task.taskType} untuk pesanan ${task.order.orderCode} kini berstatus ${input.status}.`,
      tx,
    });

    return updated;
  });
}

export async function listTasksForAdmin(filters: { status?: TaskStatus; courierId?: string; page: number; limit: number; skip: number }) {
  const where: Prisma.DeliveryTaskWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.courierId ? { courierId: filters.courierId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.deliveryTask.count({ where }),
    prisma.deliveryTask.findMany({
      where,
      include: taskInclude,
      orderBy: [{ scheduledAt: 'asc' }],
      skip: filters.skip,
      take: filters.limit,
    }),
  ]);
  return { total, rows };
}

export async function assignCourier(actor: Actor, taskId: string, courierId: string | null, ip?: string) {
  const task = await prisma.deliveryTask.findUnique({ where: { id: taskId }, include: { order: true } });
  if (!task) throw NotFound('Tugas tidak ditemukan');
  if (['completed', 'failed'].includes(task.status)) {
    throw Conflict('Tugas yang sudah selesai tidak dapat diubah');
  }
  if (courierId) {
    const courier = await prisma.user.findFirst({
      where: { id: courierId, isActive: true, roles: { some: { role: { name: ROLES.COURIER } } } },
    });
    if (!courier) throw Conflict('Kurir tidak ditemukan atau tidak aktif', 'INVALID_COURIER');
  }

  const updated = await prisma.deliveryTask.update({
    where: { id: taskId },
    data: { courierId, ...(courierId ? { status: 'assigned' } : {}) },
    include: taskInclude,
  });
  await writeAudit({
    userId: actor.userId,
    action: AUDIT.DELIVERY_TASK_ASSIGNED,
    entityType: 'delivery_task',
    entityId: taskId,
    metadata: { courierId, orderId: task.orderId },
    ip,
  });
  if (courierId) {
    await notify({
      userId: courierId,
      orderId: task.orderId,
      title: 'Tugas pengantaran baru',
      message: `Anda ditugaskan mengantar pesanan ${task.order.orderCode}.`,
    });
  }
  return updated;
}

export async function createTask(
  actor: Actor,
  orderId: string,
  input: { taskType: 'pickup' | 'delivery'; scheduledAt: string; courierId?: string | null; notes?: string | null },
  ip?: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { reservation: { include: { address: true } } },
  });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  if (input.courierId) {
    const courier = await prisma.user.findFirst({
      where: { id: input.courierId, isActive: true, roles: { some: { role: { name: ROLES.COURIER } } } },
    });
    if (!courier) throw Conflict('Kurir tidak ditemukan atau tidak aktif', 'INVALID_COURIER');
  }
  const task = await prisma.deliveryTask.create({
    data: {
      orderId,
      taskType: input.taskType,
      scheduledAt: new Date(input.scheduledAt),
      courierId: input.courierId ?? null,
      notes: input.notes ?? null,
      addressSnapshot: order.reservation?.address?.addressText ?? null,
      contactPhone: order.reservation?.address?.phone ?? null,
      status: 'assigned',
    },
    include: taskInclude,
  });
  await writeAudit({
    userId: actor.userId,
    action: AUDIT.DELIVERY_TASK_CREATED,
    entityType: 'delivery_task',
    entityId: task.id,
    metadata: { orderId, taskType: input.taskType },
    ip,
  });
  return task;
}
