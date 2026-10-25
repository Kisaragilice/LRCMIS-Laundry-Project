import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
} from '../../components/ui';
import { DataTable, Td, Th } from '../../components/common';
import { usePagedApi } from '../../lib/useApi';
import { formatDateTime } from '../../lib/format';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

const entityOptions = [
  'user',
  'service',
  'time_slot',
  'reservation',
  'order',
  'payment',
  'promotion',
  'delivery_task',
  'review',
  'complaint',
  'report',
  'auth',
];

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (action.trim()) query.set('action', action.trim());
  if (entityType) query.set('entityType', entityType);
  const logs = usePagedApi<AuditLog>(`/admin/audit-logs?${query.toString()}`, [page, action, entityType]);

  return (
    <div>
      <PageHeader
        eyebrow="Kepatuhan"
        title="Audit log"
        description="Jejak aktivitas penting pada sistem: perubahan status, pembayaran, ekspor laporan, dan tindakan administratif."
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Cari aksi" className="w-full sm:w-64">
          <Input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="payment.verified" />
        </Field>
        <Field label="Tipe entitas" className="w-full sm:w-56">
          <Select value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }}>
            <option value="">Semua entitas</option>
            {entityOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {logs.loading ? (
        <LoadingState label="Memuat audit log..." />
      ) : logs.error ? (
        <ErrorState message={logs.error} onRetry={logs.refetch} />
      ) : logs.rows.length === 0 ? (
        <EmptyState title="Tidak ada catatan audit" description="Belum ada aktivitas yang cocok dengan filter ini." icon={<ScrollText className="h-6 w-6" />} />
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Aksi</Th>
                <Th>Entitas</Th>
                <Th>Pengguna</Th>
                <Th>Metadata</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {logs.rows.map((log) => (
                <tr key={log.id} className="align-top hover:bg-sand-50/50">
                  <Td><span className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(log.createdAt)}</span></Td>
                  <Td>
                    <Badge tone={log.action.includes('delete') || log.action.includes('reject') ? 'red' : log.action.includes('create') ? 'green' : 'blue'}>
                      {log.action}
                    </Badge>
                  </Td>
                  <Td>
                    <p className="text-xs font-semibold text-ink-700">{log.entityType}</p>
                    {log.entityId && <p className="font-mono text-[10px] text-ink-400">{log.entityId.slice(0, 8)}…</p>}
                  </Td>
                  <Td>
                    {log.user ? (
                      <>
                        <p className="text-sm font-medium text-ink-800">{log.user.name}</p>
                        <p className="text-[11px] text-ink-400">{log.user.email}</p>
                      </>
                    ) : (
                      <span className="text-xs text-ink-400">Sistem</span>
                    )}
                  </Td>
                  <Td>
                    <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink-50 px-2 py-1.5 text-[10px] text-ink-600">
                      {log.metadata ? JSON.stringify(log.metadata, null, 0) : '-'}
                    </pre>
                  </Td>
                  <Td><span className="font-mono text-[11px] text-ink-400">{log.ipAddress ?? '-'}</span></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="mt-4">
            <Pagination page={page} totalPages={logs.meta?.totalPages ?? 1} total={logs.meta?.total} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
