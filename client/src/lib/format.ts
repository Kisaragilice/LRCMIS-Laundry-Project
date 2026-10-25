export const formatCurrency = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (value: number | string | null | undefined, digits = 0): string =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(Number(value ?? 0));

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
};

export const formatTime = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
};

export const weekday = (value: string): string =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${value}T12:00:00+07:00`));

export const relativeTime = (value: string | Date): string => {
  const diff = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
};

export const todayIso = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());

export const addDaysIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(date);
};

export const monthStartIso = (): string => `${todayIso().slice(0, 7)}-01`;

export const orderStatusLabel: Record<string, string> = {
  pending: 'Menunggu diterima',
  received: 'Diterima',
  washing: 'Dicuci',
  drying: 'Dikeringkan',
  ironing: 'Disetrika',
  packaging: 'Dikemas',
  ready: 'Siap',
  delivering: 'Diantar',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  on_hold: 'Ditunda',
};

export const paymentStatusLabel: Record<string, string> = {
  unpaid: 'Belum dibayar',
  partial: 'Dibayar sebagian',
  paid: 'Lunas',
  refunded: 'Direfund',
};

export const reservationStatusLabel: Record<string, string> = {
  pending: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

export const unitLabel: Record<string, string> = {
  kg: 'kg',
  piece: 'pcs',
  pair: 'pasang',
};

export const methodLabel: Record<string, string> = {
  cash: 'Tunai',
  bank_transfer: 'Transfer bank',
  payment_gateway: 'Payment gateway',
};

export const taskStatusLabel: Record<string, string> = {
  assigned: 'Ditugaskan',
  accepted: 'Diterima kurir',
  in_progress: 'Dalam perjalanan',
  completed: 'Selesai',
  failed: 'Gagal',
};

export const taskTypeLabel: Record<string, string> = {
  pickup: 'Pickup',
  delivery: 'Pengantaran',
};

export const complaintStatusLabel: Record<string, string> = {
  open: 'Baru',
  in_progress: 'Diproses',
  resolved: 'Selesai',
  closed: 'Ditutup',
};

export const badgeToneForStatus = (status: string): string => {
  if (['completed', 'paid', 'confirmed', 'resolved', 'sent', 'active'].includes(status)) return 'green';
  if (['cancelled', 'failed', 'refunded', 'expired', 'closed'].includes(status)) return 'red';
  if (['pending', 'partial'].includes(status)) return 'amber';
  if (['ready'].includes(status)) return 'brand';
  if (['received', 'washing', 'drying', 'ironing', 'packaging', 'accepted', 'in_progress', 'delivering', 'assigned'].includes(status)) return 'blue';
  return 'slate';
};
