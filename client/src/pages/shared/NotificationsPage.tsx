import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import type { Notification } from '../../lib/types';

interface NotificationResponse {
  rows: Notification[];
  unread: number;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const notifications = useApi<NotificationResponse>('/notifications/me?limit=100');
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [saving, setSaving] = useState(false);

  const rows = (notifications.data?.rows ?? []).filter((item) => tab === 'all' || !item.readAt);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    notifications.refetch();
  };

  const markAll = async () => {
    setSaving(true);
    try {
      await api.patch('/notifications/read-all');
      toast('Semua notifikasi ditandai sudah dibaca');
      notifications.refetch();
    } finally {
      setSaving(false);
    }
  };

  const orderLink = (orderId: string | null) => {
    if (!orderId) return null;
    if (user?.roles.includes('admin')) return `/admin/pesanan/${orderId}`;
    if (user?.roles.includes('staff')) return `/staff/pesanan/${orderId}`;
    if (user?.roles.includes('courier')) return null;
    return `/pesanan/${orderId}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pemberitahuan"
        title="Notifikasi"
        description="Pembaruan status pesanan, pembayaran, tugas, dan tindak lanjut keluhan."
        actions={
          <Button variant="outline" onClick={markAll} loading={saving} icon={<CheckCheck className="h-4 w-4" />}>
            Tandai semua dibaca
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'Semua' },
            { value: 'unread', label: `Belum dibaca${notifications.data?.unread ? ` (${notifications.data.unread})` : ''}` },
          ]}
        />
        {notifications.data?.unread ? <Badge tone="amber">{notifications.data.unread} belum dibaca</Badge> : <Badge tone="green">Semua terbaca</Badge>}
      </div>

      {notifications.loading ? (
        <LoadingState label="Memuat notifikasi..." />
      ) : notifications.error ? (
        <ErrorState message={notifications.error} onRetry={notifications.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'unread' ? 'Tidak ada notifikasi belum dibaca' : 'Belum ada notifikasi'}
          description="Notifikasi akan muncul saat ada pembaruan pada akun atau pesanan Anda."
          icon={<Bell className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <Card key={item.id} className={`p-5 ${item.readAt ? '' : 'border-brand-200 bg-brand-50/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.readAt ? 'bg-ink-50 text-ink-500' : 'bg-brand-100 text-brand-800'}`}>
                  {item.readAt ? <Bell className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-ink-950">{item.title}</p>
                    {!item.readAt && <Badge tone="brand">Baru</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.message}</p>
                  <p className="mt-1 text-xs text-ink-400">{formatDateTime(item.createdAt)} · {item.channel}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {orderLink(item.orderId) && (
                      <Link to={orderLink(item.orderId)!} className="text-xs font-bold text-brand-700 hover:text-brand-900">
                        Lihat pesanan →
                      </Link>
                    )}
                    {!item.readAt && (
                      <button type="button" onClick={() => markRead(item.id)} className="text-xs font-semibold text-ink-500 hover:text-ink-800">
                        Tandai dibaca
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
