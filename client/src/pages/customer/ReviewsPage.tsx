import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Textarea } from '../../components/ui';
import { Stars } from '../../components/common';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatDateTime, orderStatusLabel } from '../../lib/format';
import type { Order } from '../../lib/types';

export function ReviewsPage() {
  const { toast } = useToast();
  const orders = useApi<Order[]>('/orders/me');
  const [target, setTarget] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = (orders.data ?? []).filter((order) => order.orderStatus === 'completed');
  const reviewed = completed.filter((order) => order.review);
  const pendingReview = completed.filter((order) => !order.review);
  const averageGiven = reviewed.length
    ? reviewed.reduce((sum, order) => sum + (order.review?.rating ?? 0), 0) / reviewed.length
    : 0;

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/orders/${target.id}/reviews`, { rating, comment: comment.trim() || undefined });
      toast('Ulasan berhasil dikirim');
      setTarget(null);
      setComment('');
      setRating(5);
      orders.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim ulasan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Umpan balik"
        title="Ulasan saya"
        description="Berikan penilaian untuk pesanan yang telah selesai. Satu pesanan hanya dapat diulas satu kali."
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-5">
          {orders.loading ? (
            <LoadingState label="Memuat pesanan..." />
          ) : orders.error ? (
            <ErrorState message={orders.error} onRetry={orders.refetch} />
          ) : (
            <>
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink-950">Menunggu ulasan</h2>
                    <p className="mt-1 text-xs text-ink-500">Pesanan selesai yang belum Anda nilai.</p>
                  </div>
                  <Star className="h-5 w-5 text-amber-400" />
                </div>
                {pendingReview.length === 0 ? (
                  <div className="mt-4"><EmptyState title="Tidak ada pesanan menunggu ulasan" description="Semua pesanan selesai sudah Anda nilai." /></div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pendingReview.map((order) => (
                      <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-ink-900">{order.orderCode}</p>
                          <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(order.completedAt ?? order.updatedAt)} · {orderStatusLabel[order.orderStatus]}</p>
                          <p className="mt-0.5 text-xs text-ink-500">{order.items.map((item) => item.serviceName).join(', ')}</p>
                        </div>
                        <Button size="sm" onClick={() => { setTarget(order); setRating(5); setComment(''); setError(null); }}>
                          Beri ulasan
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="text-base font-bold text-ink-950">Ulasan yang sudah dikirim</h2>
                {reviewed.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-500">Belum ada ulasan yang Anda kirim.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {reviewed.map((order) => (
                      <div key={order.id} className="rounded-xl border border-ink-100 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-ink-900">{order.orderCode}</p>
                            <p className="text-xs text-ink-400">{formatDateTime(order.updatedAt)}</p>
                          </div>
                          <Stars value={order.review?.rating ?? 0} size="sm" />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink-600">{order.review?.comment || 'Tanpa komentar.'}</p>
                        <Link to={`/pesanan/${order.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900">
                          Lihat pesanan <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">Statistik ulasan Anda</p>
            <p className="mt-2 text-3xl font-extrabold text-ink-950">{averageGiven ? averageGiven.toFixed(1) : '—'}</p>
            <div className="mt-1"><Stars value={Math.round(averageGiven)} size="sm" /></div>
            <p className="mt-2 text-xs text-ink-500">{reviewed.length} ulasan terkirim · {pendingReview.length} menunggu</p>
          </Card>
          <Card className="bg-brand-950 p-5 text-white">
            <p className="font-display text-xl font-semibold">Ulasan hanya dari pesanan nyata</p>
            <p className="mt-2 text-sm leading-relaxed text-brand-100/70">
              Sistem memverifikasi kepemilikan pesanan dan status selesai sebelum menerima ulasan. Ini menjaga
              kredibilitas penilaian di halaman publik.
            </p>
          </Card>
        </div>
      </div>

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Beri ulasan" description={target?.orderCode} size="sm">
        <div className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <p className="text-sm font-semibold text-ink-800">Rating</p>
            <div className="mt-2"><Stars value={rating} onChange={setRating} size="lg" /></div>
          </div>
          <Field label="Komentar" htmlFor="reviewComment" hint="Opsional, maksimal 1000 karakter">
            <Textarea id="reviewComment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Ceritakan kualitas layanan yang Anda terima..." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
            <Button onClick={submit} loading={saving}>Kirim ulasan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
