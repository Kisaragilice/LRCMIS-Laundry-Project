import { Prisma, type ChatConversationType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ROLES } from '../config/constants';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors';
import { notify } from './notification.service';

type Actor = { userId: string; roles: string[] };

const ADMIN_TYPES: ChatConversationType[] = ['admin_customer', 'admin_staff', 'admin_courier'];

const roleLabels: Record<string, string> = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.CUSTOMER]: 'Pelanggan',
  [ROLES.STAFF]: 'Staff',
  [ROLES.COURIER]: 'Kurir',
  [ROLES.OWNER]: 'Owner',
};

const roleToAdminType: Record<string, ChatConversationType> = {
  [ROLES.CUSTOMER]: 'admin_customer',
  [ROLES.STAFF]: 'admin_staff',
  [ROLES.COURIER]: 'admin_courier',
};

const subjectRoleOrder = [ROLES.CUSTOMER, ROLES.STAFF, ROLES.COURIER];

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  roles: { include: { role: true } },
} satisfies Prisma.UserSelect;

const messageInclude = {
  sender: { select: { id: true, name: true } },
} satisfies Prisma.ChatMessageInclude;

function conversationInclude(userId: string) {
  return {
    subjectUser: { select: publicUserSelect },
    customer: { select: publicUserSelect },
    courier: { select: publicUserSelect },
    order: { select: { id: true, orderCode: true, orderStatus: true } },
    messages: {
      orderBy: { createdAt: 'desc' as const },
      take: 1,
      include: messageInclude,
    },
    reads: { where: { userId }, take: 1 },
  } satisfies Prisma.ChatConversationInclude;
}

type ConversationWithDetails = Prisma.ChatConversationGetPayload<{
  include: ReturnType<typeof conversationInclude>;
}>;

type UserWithRoles = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function rolesOf(user: UserWithRoles) {
  return user.roles.map((entry) => entry.role.name);
}

function primarySubjectRole(user: UserWithRoles) {
  const roles = rolesOf(user);
  return subjectRoleOrder.find((role) => roles.includes(role)) ?? null;
}

function isAdmin(actor: Actor) {
  return actor.roles.includes(ROLES.ADMIN);
}

function accessWhere(actor: Actor): Prisma.ChatConversationWhereInput {
  if (isAdmin(actor)) return { type: { in: ADMIN_TYPES } };

  const clauses: Prisma.ChatConversationWhereInput[] = [];
  if (actor.roles.includes(ROLES.CUSTOMER)) {
    clauses.push(
      { type: 'admin_customer', subjectUserId: actor.userId },
      { type: 'courier_customer', customerId: actor.userId },
    );
  }
  if (actor.roles.includes(ROLES.STAFF)) {
    clauses.push({ type: 'admin_staff', subjectUserId: actor.userId });
  }
  if (actor.roles.includes(ROLES.COURIER)) {
    clauses.push(
      { type: 'admin_courier', subjectUserId: actor.userId },
      { type: 'courier_customer', courierId: actor.userId },
    );
  }
  return clauses.length > 0 ? { OR: clauses } : { id: '00000000-0000-0000-0000-000000000000' };
}

async function loadAccessibleConversation(actor: Actor, id: string) {
  const conversation = await prisma.chatConversation.findFirst({
    where: { AND: [{ id }, accessWhere(actor)] },
    include: conversationInclude(actor.userId),
  });
  if (!conversation) throw NotFound('Percakapan tidak ditemukan atau bukan milik Anda');
  return conversation;
}

function otherParticipant(conversation: ConversationWithDetails, actor: Actor) {
  if (conversation.type === 'courier_customer') {
    return conversation.courierId === actor.userId ? conversation.customer : conversation.courier;
  }
  if (isAdmin(actor)) return conversation.subjectUser;
  return null;
}

function conversationTitle(conversation: ConversationWithDetails, actor: Actor) {
  const other = otherParticipant(conversation, actor);
  if (other) return other.name;
  return 'Administrasi LRCMIS';
}

function conversationSubtitle(conversation: ConversationWithDetails, actor: Actor) {
  if (conversation.type === 'courier_customer') {
    const order = conversation.order;
    return order ? `Pengantaran ${order.orderCode}` : 'Chat pengantaran';
  }
  if (isAdmin(actor)) {
    const role = conversation.subjectUser ? primarySubjectRole(conversation.subjectUser) : null;
    return role ? roleLabels[role] ?? role : 'Percakapan admin';
  }
  return 'Administrasi LRCMIS';
}

function canSendMessage(conversation: ConversationWithDetails) {
  if (conversation.type !== 'courier_customer') return true;
  return conversation.order?.orderStatus === 'delivering';
}

async function serializeConversation(conversation: ConversationWithDetails, actor: Actor) {
  const other = otherParticipant(conversation, actor);
  const lastRead = conversation.reads[0]?.lastReadAt;
  const unread = await prisma.chatMessage.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: actor.userId },
      ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
    },
  });

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversationTitle(conversation, actor),
    subtitle: conversationSubtitle(conversation, actor),
    counterpart: other
      ? {
          id: other.id,
          name: other.name,
          email: other.email,
          phone: other.phone,
          role: primarySubjectRole(other),
        }
      : null,
    order: conversation.order,
    lastMessage: conversation.messages[0]
      ? {
          id: conversation.messages[0].id,
          body: conversation.messages[0].body,
          senderId: conversation.messages[0].senderId,
          senderName: conversation.messages[0].sender.name,
          createdAt: conversation.messages[0].createdAt,
        }
      : null,
    unread,
    canSend: canSendMessage(conversation),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

async function serializeMessages(conversationId: string) {
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: messageInclude,
  });
  return recent.reverse().map((message) => ({
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    senderName: message.sender.name,
    createdAt: message.createdAt,
  }));
}

export async function listConversations(actor: Actor) {
  const conversations = await prisma.chatConversation.findMany({
    where: accessWhere(actor),
    include: conversationInclude(actor.userId),
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return Promise.all(conversations.map((conversation) => serializeConversation(conversation, actor)));
}

export async function getMessages(actor: Actor, id: string) {
  const conversation = await loadAccessibleConversation(actor, id);
  const messages = await serializeMessages(id);
  await prisma.chatRead.upsert({
    where: { conversationId_userId: { conversationId: id, userId: actor.userId } },
    create: { conversationId: id, userId: actor.userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
  const serialized = await serializeConversation(conversation, actor);
  return { conversation: { ...serialized, unread: 0 }, messages };
}

async function conversationRecipients(conversation: ConversationWithDetails, actor: Actor) {
  if (conversation.type !== 'courier_customer') {
    if (isAdmin(actor)) return conversation.subjectUserId ? [conversation.subjectUserId] : [];
    const admins = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name: ROLES.ADMIN } } },
        id: { not: actor.userId },
      },
      select: { id: true },
    });
    return admins.map((admin) => admin.id);
  }

  const recipient = conversation.courierId === actor.userId ? conversation.customerId : conversation.courierId;
  return recipient ? [recipient] : [];
}

export async function sendMessage(actor: Actor, id: string, body: string) {
  const conversation = await loadAccessibleConversation(actor, id);
  if (!canSendMessage(conversation)) {
    throw Conflict('Chat pengantaran hanya tersedia selama pesanan sedang diantar', 'CHAT_DELIVERY_INACTIVE');
  }

  const sender = await prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, name: true } });
  const recipients = await conversationRecipients(conversation, actor);
  const notificationBody = body.length > 140 ? `${body.slice(0, 137)}...` : body;

  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: { conversationId: id, senderId: actor.userId, body },
      include: messageInclude,
    });
    await tx.chatConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    await tx.chatRead.upsert({
      where: { conversationId_userId: { conversationId: id, userId: actor.userId } },
      create: { conversationId: id, userId: actor.userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });

    for (const recipientId of new Set(recipients)) {
      await notify({
        userId: recipientId,
        orderId: conversation.type === 'courier_customer' ? conversation.orderId : null,
        title: `Pesan baru dari ${sender?.name ?? 'Pengguna'}`,
        message: notificationBody,
        tx,
      });
    }

    return {
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      senderName: message.sender.name,
      createdAt: message.createdAt,
    };
  });
}

async function ensureAdminConversation(type: ChatConversationType, subjectUserId: string, actor: Actor) {
  const existing = await prisma.chatConversation.findUnique({
    where: { type_subjectUserId: { type, subjectUserId } },
    include: conversationInclude(actor.userId),
  });
  if (existing) return existing;

  try {
    return await prisma.chatConversation.create({
      data: { type, subjectUserId },
      include: conversationInclude(actor.userId),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.chatConversation.findUnique({
        where: { type_subjectUserId: { type, subjectUserId } },
        include: conversationInclude(actor.userId),
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function startAdminConversation(actor: Actor, userId: string) {
  if (!isAdmin(actor)) throw Forbidden('Hanya administrator yang dapat memulai percakapan ini');

  const target = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: publicUserSelect,
  });
  if (!target) throw NotFound('Pengguna tidak ditemukan atau tidak aktif');

  const role = primarySubjectRole(target);
  if (!role) throw BadRequest('Pengguna ini tidak dapat dihubungi melalui chat admin');
  const type = roleToAdminType[role];

  const conversation = await ensureAdminConversation(type, target.id, actor);
  return serializeConversation(conversation, actor);
}

export async function startAdminThread(actor: Actor) {
  if (isAdmin(actor)) throw BadRequest('Administrator tidak memerlukan percakapan pribadi dengan admin');

  const role = subjectRoleOrder.find((candidate) => actor.roles.includes(candidate));
  if (!role) throw Forbidden('Peran Anda tidak memiliki akses ke chat admin');
  const type = roleToAdminType[role];

  const conversation = await ensureAdminConversation(type, actor.userId, actor);
  return serializeConversation(conversation, actor);
}

export async function listAdminContacts(actor: Actor) {
  if (!isAdmin(actor)) throw Forbidden('Hanya administrator yang dapat melihat daftar kontak');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: {
        some: { role: { name: { in: subjectRoleOrder } } },
        none: { role: { name: ROLES.ADMIN } },
      },
    },
    select: publicUserSelect,
    orderBy: { name: 'asc' },
    take: 300,
  });

  const conversations = await prisma.chatConversation.findMany({
    where: { type: { in: ADMIN_TYPES }, subjectUserId: { in: users.map((user) => user.id) } },
    select: { id: true, type: true, subjectUserId: true },
  });
  const conversationByUser = new Map(conversations.map((conversation) => [conversation.subjectUserId, conversation.id]));

  return users
    .map((user) => {
      const role = primarySubjectRole(user);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role,
        roleLabel: role ? roleLabels[role] ?? role : null,
        conversationId: conversationByUser.get(user.id) ?? null,
      };
    })
    .filter((contact) => contact.role);
}

export async function listDeliveryContacts(actor: Actor) {
  if (actor.roles.includes(ROLES.COURIER)) {
    const tasks = await prisma.deliveryTask.findMany({
      where: {
        courierId: actor.userId,
        taskType: 'delivery',
        status: 'in_progress',
        order: { orderStatus: 'delivering' },
      },
      include: {
        order: {
          include: {
            customer: { select: publicUserSelect },
            chatConversation: { select: { id: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    return tasks.map((task) => ({
      orderId: task.orderId,
      orderCode: task.order.orderCode,
      orderStatus: task.order.orderStatus,
      counterpart: {
        id: task.order.customer.id,
        name: task.order.customer.name,
        phone: task.order.customer.phone,
      },
      conversationId: task.order.chatConversation?.id ?? null,
    }));
  }

  if (actor.roles.includes(ROLES.CUSTOMER)) {
    const orders = await prisma.order.findMany({
      where: { customerId: actor.userId, orderStatus: 'delivering' },
      include: {
        deliveryTasks: {
          where: { taskType: 'delivery', status: 'in_progress', courierId: { not: null } },
          include: { courier: { select: publicUserSelect } },
          orderBy: { createdAt: 'desc' },
        },
        chatConversation: { select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return orders
      .map((order) => {
        const activeTask = order.deliveryTasks[0];
        if (!activeTask?.courier) return null;
        return {
          orderId: order.id,
          orderCode: order.orderCode,
          orderStatus: order.orderStatus,
          counterpart: {
            id: activeTask.courier.id,
            name: activeTask.courier.name,
            phone: activeTask.courier.phone,
          },
          conversationId: order.chatConversation?.id ?? null,
        };
      })
      .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
  }

  return [];
}

export async function startOrderThread(actor: Actor, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      deliveryTasks: {
        where: { taskType: 'delivery' },
        include: { courier: true },
        orderBy: { createdAt: 'desc' },
      },
      chatConversation: true,
    },
  });
  if (!order) throw NotFound('Pesanan tidak ditemukan');
  if (order.orderStatus !== 'delivering') {
    throw Conflict('Chat pengantaran hanya tersedia saat pesanan sedang diantar', 'CHAT_DELIVERY_INACTIVE');
  }

  const activeTask = order.deliveryTasks.find((task) => task.status === 'in_progress' && task.courierId);
  if (!activeTask?.courierId) {
    throw Conflict('Belum ada kurir yang sedang mengantar pesanan ini', 'CHAT_COURIER_UNAVAILABLE');
  }

  if (actor.roles.includes(ROLES.COURIER) && activeTask.courierId !== actor.userId) {
    throw Forbidden('Pesanan ini sedang diantar oleh kurir lain');
  }
  if (actor.roles.includes(ROLES.CUSTOMER) && order.customerId !== actor.userId) {
    throw Forbidden('Pesanan ini bukan milik Anda');
  }

  if (order.chatConversation) {
    const existing = await prisma.chatConversation.update({
      where: { id: order.chatConversation.id },
      data: { courierId: activeTask.courierId },
      include: conversationInclude(actor.userId),
    });
    return serializeConversation(existing, actor);
  }

  try {
    const created = await prisma.chatConversation.create({
      data: {
        type: 'courier_customer',
        orderId,
        customerId: order.customerId,
        courierId: activeTask.courierId,
      },
      include: conversationInclude(actor.userId),
    });
    return serializeConversation(created, actor);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.chatConversation.findUnique({
        where: { orderId },
        include: conversationInclude(actor.userId),
      });
      if (raced) return serializeConversation(raced, actor);
    }
    throw error;
  }
}
