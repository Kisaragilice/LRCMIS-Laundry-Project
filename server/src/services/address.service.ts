import { prisma } from '../config/prisma';
import { BadRequest, Conflict, NotFound } from '../utils/errors';
import { writeAudit } from './audit.service';

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAddress(userId: string, data: {
  label?: string;
  recipientName?: string;
  phone?: string;
  addressText: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}) {
  const count = await prisma.address.count({ where: { userId } });
  if (count >= 10) throw BadRequest('Maksimal 10 alamat tersimpan per akun');

  return prisma.$transaction(async (tx) => {
    const makeDefault = data.isDefault === true || count === 0;
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const address = await tx.address.create({
      data: {
        userId,
        label: data.label,
        recipientName: data.recipientName,
        phone: data.phone,
        addressText: data.addressText,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault: makeDefault,
      },
    });
    await writeAudit(
      {
        userId,
        action: 'address.created',
        entityType: 'address',
        entityId: address.id,
      },
      tx,
    );
    return address;
  });
}

export async function updateAddress(userId: string, addressId: string, data: {
  label?: string;
  recipientName?: string;
  phone?: string;
  addressText?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}) {
  const existing = await prisma.address.findUnique({ where: { id: addressId } });
  if (!existing) throw NotFound('Alamat tidak ditemukan');
  if (existing.userId !== userId) throw NotFound('Alamat tidak ditemukan');

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId, id: { not: addressId } }, data: { isDefault: false } });
    }
    const address = await tx.address.update({ where: { id: addressId }, data });
    await writeAudit({ userId, action: 'address.updated', entityType: 'address', entityId: addressId }, tx);
    return address;
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const existing = await prisma.address.findUnique({
    where: { id: addressId },
    include: { reservations: { where: { status: { in: ['pending', 'confirmed'] } }, select: { id: true } } },
  });
  if (!existing || existing.userId !== userId) throw NotFound('Alamat tidak ditemukan');
  if (existing.reservations.length > 0) {
    throw Conflict('Alamat masih dipakai pada reservasi aktif', 'ADDRESS_IN_USE');
  }
  await prisma.address.delete({ where: { id: addressId } });
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await writeAudit({ userId, action: 'address.deleted', entityType: 'address', entityId: addressId });
  return { message: 'Alamat berhasil dihapus' };
}
