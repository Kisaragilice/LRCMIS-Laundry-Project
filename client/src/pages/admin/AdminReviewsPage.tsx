import { useState } from 'react';
import { Star } from 'lucide-react';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  StatCard,
} from '../../components/ui';
import { DataTable, Stars, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { formatDateTime } from '../../lib/format';
import type { Review } from '../../lib/types';

interface ReviewPayload {
  rows: Review[];
  averageRating: number | null;
  totalReviews: number;
}

export function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState('');
  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (rating) query.set('rating', rating);
  const reviews = usePagedApi<ReviewPayload>(`/admin/reviews?${query.toString()}`, [page, rating]);

  const payload = Array.isArray(reviews.rows)
    ? null
    : (reviews.rows as unknown as ReviewPayload | null);
  const rows = payload?.rows ?? [];
  const average = payload?.averageRating ?? null;
  const totalReviews = payload?.totalReviews ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Kualitas"
        title="Ulasan pelanggan"
        description="Pantau kepuasan pelanggan berdasarkan ulasan pesanan yang telah selesai."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Rata-rata rating" value={average === null ? '-' : `${average.toFixed(1)} / 5`} icon={<Star className="h-5 w-5" />} />
        <StatCard label="Total ulasan" value={totalReviews} tone="blue" icon={<Star className="h-5 w-5" />} />
        <StatCard label="Ulasan pada filter" value={reviews.meta?.total ?? rows.length} tone="sand" />
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Filter rating" className="w-full sm:w-48">
          <Select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}>
            <option value="">Semua rating</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} bintang</option>
            ))}
          </Select>
        </Field>
      </Card>

      {reviews.loading ? (
        <LoadingState label="Memuat ulasan..." />
      ) : reviews.error ? (
        <ErrorState message={reviews.error} onRetry={reviews.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada ulasan" description="Ulasan akan muncul setelah pelanggan menilai pesanan selesai." icon={<Star className="h-6 w-6" />} />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <Th>Pelanggan</Th>
                <Th>Rating</Th>
                <Th>Komentar</Th>
                <Th>Pesanan</Th>
                <Th>Tanggal</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {rows.map((review) => (
                <tr key={review.id} className="hover:bg-sand-50/50">
                  <Td>
                    <p className="font-semibold text-ink-900">{review.user?.name ?? '-'}</p>
                    <p className="text-[11px] text-ink-400">{review.user?.email}</p>
                  </Td>
                  <Td><Stars value={review.rating} size="sm" /></Td>
                  <Td><p className="max-w-md whitespace-pre-line text-sm text-ink-600">{review.comment || <span className="text-ink-300">Tanpa komentar</span>}</p></Td>
                  <Td>
                    <p className="font-mono text-xs font-semibold text-ink-700">{review.order?.orderCode ?? '-'}</p>
                    <p className="text-[11px] text-ink-400">{review.order?.items?.map((item) => item.serviceNameSnapshot).join(', ')}</p>
                  </Td>
                  <Td><span className="text-xs text-ink-500">{formatDateTime(review.createdAt)}</span></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="mt-4">
            <Pagination page={page} totalPages={reviews.meta?.totalPages ?? 1} total={reviews.meta?.total} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
