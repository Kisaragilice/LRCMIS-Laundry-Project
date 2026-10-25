import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Textarea,
  cn,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { formatTime, orderStatusLabel } from '../../lib/format';
import type {
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatThread,
  DeliveryChatContact,
} from '../../lib/types';

const typeLabels: Record<ChatConversation['type'], string> = {
  admin_customer: 'Admin · Pelanggan',
  admin_staff: 'Admin · Staff',
  admin_courier: 'Admin · Kurir',
  courier_customer: 'Kurir · Pelanggan',
};

const roleLabels: Record<string, string> = {
  customer: 'Pelanggan',
  admin: 'Administrator',
  staff: 'Staff',
  courier: 'Kurir',
  owner: 'Owner',
};

function shortTime(value: string) {
  return formatTime(value);
}

function Avatar({ name, tone = 'brand' }: { name: string; tone?: 'brand' | 'sky' | 'amber' }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold',
        tone === 'brand' && 'bg-brand-50 text-brand-700',
        tone === 'sky' && 'bg-sky-50 text-sky-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
      )}
    >
      {name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ChatConversation;
  active: boolean;
  onSelect: () => void;
}) {
  const tone = conversation.type === 'courier_customer' ? 'amber' : 'brand';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full gap-3 rounded-2xl border p-3 text-left transition',
        active
          ? 'border-brand-300 bg-brand-50/70 shadow-sm'
          : 'border-transparent hover:border-ink-100 hover:bg-sand-50/70',
      )}
    >
      <Avatar name={conversation.title} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-bold text-ink-900">{conversation.title}</span>
          {conversation.unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
              {conversation.unread > 99 ? '99+' : conversation.unread}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
          {conversation.type === 'courier_customer' ? (
            <Truck className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{conversation.subtitle}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-400">
            {conversation.lastMessage
              ? `${conversation.lastMessage.senderName}: ${conversation.lastMessage.body}`
              : 'Belum ada pesan'}
          </span>
          {conversation.lastMessage && (
            <span className="shrink-0 text-[10px] font-semibold text-ink-300">
              {shortTime(conversation.lastMessage.createdAt)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function MessageBubble({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%]',
          own ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-ink-100 bg-white text-ink-800',
        )}
      >
        {!own && <p className="mb-1 text-[11px] font-bold text-brand-700">{message.senderName}</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
        <p className={cn('mt-1 text-right text-[10px]', own ? 'text-brand-100' : 'text-ink-300')}>
          {shortTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('conversation'));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'customer' | 'staff' | 'courier'>('all');
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');
  const canUseDelivery = roles.includes('courier') || roles.includes('customer');

  const conversations = useApi<ChatConversation[]>('/chat/conversations');
  const thread = useApi<ChatThread>(selectedId ? `/chat/conversations/${selectedId}/messages` : null, [selectedId]);
  const deliveryContacts = useApi<DeliveryChatContact[]>(canUseDelivery ? '/chat/delivery-contacts' : null);
  const contacts = useApi<ChatContact[]>(isAdmin && newChatOpen ? '/chat/contacts' : null, [newChatOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      conversations.refetch();
      if (canUseDelivery) deliveryContacts.refetch();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [conversations.refetch, deliveryContacts.refetch, canUseDelivery]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => thread.refetch(), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, thread.refetch]);

  useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, thread.data?.messages.length]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setSearchParams({ conversation: id }, { replace: true });
    setMobileListOpen(false);
    setSendError(null);
    setDraft('');
  };

  const conversationList = useMemo(() => {
    const rows = conversations.data ?? [];
    if (!isAdmin || filter === 'all') return rows;
    const type = filter === 'customer' ? 'admin_customer' : filter === 'staff' ? 'admin_staff' : 'admin_courier';
    return rows.filter((row) => row.type === type);
  }, [conversations.data, filter, isAdmin]);

  const adminConversation = useMemo(
    () => (conversations.data ?? []).find((row) => row.type.startsWith('admin_')),
    [conversations.data],
  );

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    const rows = contacts.data ?? [];
    if (!query) return rows;
    return rows.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        (contact.roleLabel ?? '').toLowerCase().includes(query),
    );
  }, [contactSearch, contacts.data]);

  const openContact = async (contact: ChatContact) => {
    if (contact.conversationId) {
      selectConversation(contact.conversationId);
      setNewChatOpen(false);
      return;
    }
    setStarting(contact.id);
    setStartError(null);
    try {
      const conversation = await api.post<ChatConversation>('/chat/conversations', { userId: contact.id });
      setNewChatOpen(false);
      conversations.refetch();
      selectConversation(conversation.id);
      toast(`Percakapan dengan ${contact.name} dimulai`);
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Gagal memulai percakapan');
    } finally {
      setStarting(null);
    }
  };

  const startAdminThread = async () => {
    if (starting) return;
    setStarting('admin');
    setStartError(null);
    try {
      const conversation = await api.post<ChatConversation>('/chat/admin-thread');
      conversations.refetch();
      selectConversation(conversation.id);
      toast('Percakapan dengan admin dimulai');
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Gagal memulai chat admin');
    } finally {
      setStarting(null);
    }
  };

  const openDeliveryChat = async (contact: DeliveryChatContact) => {
    if (contact.conversationId) {
      selectConversation(contact.conversationId);
      return;
    }
    setStarting(contact.orderId);
    setStartError(null);
    try {
      const conversation = await api.post<ChatConversation>(`/chat/orders/${contact.orderId}/thread`);
      conversations.refetch();
      deliveryContacts.refetch();
      selectConversation(conversation.id);
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : 'Gagal membuka chat pengantaran');
    } finally {
      setStarting(null);
    }
  };

  const sendMessage = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/chat/conversations/${selectedId}/messages`, { body: draft.trim() });
      setDraft('');
      thread.refetch();
      conversations.refetch();
    } catch (error) {
      setSendError(error instanceof ApiError ? error.message : 'Pesan gagal dikirim');
    } finally {
      setSending(false);
    }
  };

  const activeConversation = thread.data?.conversation;
  const messages = thread.data?.messages ?? [];

  const pageDescription = isAdmin
    ? 'Balas pesan pelanggan, staff, dan kurir dari satu kotak masuk yang dibagikan ke seluruh administrator.'
    : roles.includes('courier')
      ? 'Hubungi admin atau pelanggan yang paketnya sedang Anda antar.'
      : roles.includes('customer')
        ? 'Hubungi admin atau kurir yang sedang mengantar paket Anda.'
        : 'Hubungi administrator untuk kebutuhan operasional Anda.';

  return (
    <div>
      <PageHeader
        eyebrow="Komunikasi"
        title="Chat"
        description={pageDescription}
        actions={
          isAdmin ? (
            <Button
              icon={<MessageSquarePlus className="h-4 w-4" />}
              onClick={() => {
                setStartError(null);
                setNewChatOpen(true);
              }}
            >
              Percakapan baru
            </Button>
          ) : !adminConversation ? (
            <Button
              icon={<MessageCircle className="h-4 w-4" />}
              onClick={startAdminThread}
              loading={starting === 'admin'}
            >
              Chat admin
            </Button>
          ) : undefined
        }
      />

      {startError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{startError}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className={cn('overflow-hidden', !mobileListOpen && 'hidden lg:block')}>
          <div className="border-b border-ink-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink-900">Percakapan</p>
                <p className="text-xs text-ink-400">
                  {conversationList.length} percakapan aktif
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                onClick={() => {
                  setMobileListOpen(true);
                  conversations.refetch();
                  deliveryContacts.refetch();
                }}
              >
                Muat ulang
              </Button>
            </div>
            {isAdmin && (
              <div className="mt-3 flex flex-wrap gap-1">
                {[
                  { key: 'all', label: 'Semua' },
                  { key: 'customer', label: 'Pelanggan' },
                  { key: 'staff', label: 'Staff' },
                  { key: 'courier', label: 'Kurir' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key as typeof filter)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-bold transition',
                      filter === item.key
                        ? 'bg-brand-600 text-white'
                        : 'bg-sand-100 text-ink-600 hover:bg-sand-200',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-2">
            {conversations.error && (
              <div className="p-2">
                <ErrorState message={conversations.error} onRetry={conversations.refetch} />
              </div>
            )}
            {conversations.loading && !conversations.data && <LoadingState label="Memuat percakapan..." />}
            {!conversations.loading && !conversations.error && conversationList.length === 0 && (
              <EmptyState
                title={isAdmin ? 'Belum ada percakapan' : 'Belum ada chat admin'}
                description={
                  isAdmin
                    ? 'Mulai percakapan baru dengan pelanggan, staff, atau kurir.'
                    : 'Mulai percakapan dengan tim administrasi untuk mendapatkan bantuan.'
                }
                action={
                  isAdmin ? (
                    <Button size="sm" onClick={() => setNewChatOpen(true)}>
                      Percakapan baru
                    </Button>
                  ) : (
                    <Button size="sm" onClick={startAdminThread} loading={starting === 'admin'}>
                      Mulai chat admin
                    </Button>
                  )
                }
              />
            )}
            <div className="space-y-1">
              {conversationList.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === selectedId}
                  onSelect={() => selectConversation(conversation.id)}
                />
              ))}
            </div>

            {canUseDelivery && (
              <div className="mt-3 border-t border-ink-100 pt-3">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                  Pengantaran aktif
                </p>
                {deliveryContacts.loading && !deliveryContacts.data && (
                  <p className="px-2 py-3 text-xs text-ink-400">Memuat pengantaran...</p>
                )}
                {!deliveryContacts.loading && (deliveryContacts.data?.length ?? 0) === 0 && (
                  <p className="px-2 py-3 text-xs text-ink-400">
                    Chat kurir tersedia saat paket sedang diantar.
                  </p>
                )}
                <div className="mt-1 space-y-1">
                  {(deliveryContacts.data ?? []).map((contact) => (
                    <button
                      key={contact.orderId}
                      type="button"
                      onClick={() => openDeliveryChat(contact)}
                      disabled={starting === contact.orderId}
                      className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-amber-100 hover:bg-amber-50/60 disabled:opacity-60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <Truck className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink-900">{contact.counterpart.name}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {contact.orderCode} · {orderStatusLabel[contact.orderStatus] ?? contact.orderStatus}
                        </span>
                      </span>
                      {starting === contact.orderId && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className={cn('flex min-h-[560px] flex-col overflow-hidden', mobileListOpen && 'hidden lg:flex')}>
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                title="Pilih percakapan"
                description="Pesan akan muncul di sini setelah Anda memilih percakapan."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => setMobileListOpen(true)}
                  >
                    Lihat daftar
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-ink-100 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={activeConversation?.title ?? 'Chat'}
                    tone={activeConversation?.type === 'courier_customer' ? 'amber' : 'brand'}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {activeConversation?.title ?? 'Percakapan'}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {activeConversation?.subtitle ?? 'Memuat...'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {activeConversation?.order && (
                    <Badge tone={activeConversation.order.orderStatus === 'delivering' ? 'amber' : 'green'}>
                      {orderStatusLabel[activeConversation.order.orderStatus] ?? activeConversation.order.orderStatus}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="lg:hidden"
                    onClick={() => setMobileListOpen(true)}
                  >
                    Daftar
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-sand-50/40 p-4">
                {thread.loading && !thread.data && <LoadingState label="Memuat pesan..." />}
                {thread.error && (
                  <ErrorState message={thread.error} onRetry={thread.refetch} />
                )}
                {!thread.loading && !thread.error && messages.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState
                      title="Belum ada pesan"
                      description="Tulis pesan pertama untuk memulai percakapan."
                    />
                  </div>
                )}
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} own={message.senderId === user?.id} />
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-ink-100 p-3">
                {activeConversation && !activeConversation.canSend && (
                  <p className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    Percakapan ini hanya dapat dibaca karena pengantaran sudah selesai.
                  </p>
                )}
                {sendError && (
                  <p className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {sendError}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder={
                      activeConversation?.canSend === false
                        ? 'Pengantaran selesai — pesan tidak dapat dikirim'
                        : 'Tulis pesan... (Enter untuk kirim)'
                    }
                    disabled={sending || activeConversation?.canSend === false}
                    maxLength={2000}
                    className="min-h-[52px] max-h-36"
                  />
                  <Button
                    onClick={sendMessage}
                    loading={sending}
                    disabled={!draft.trim() || activeConversation?.canSend === false}
                    icon={<Send className="h-4 w-4" />}
                    className="mb-0.5"
                  >
                    Kirim
                  </Button>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-ink-400">
                  <span>Pesan disimpan di riwayat percakapan.</span>
                  <span>{draft.length}/2000</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="Percakapan baru"
        description="Pilih pelanggan, staff, atau kurir. Percakapan admin dibagikan ke seluruh administrator."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <Input
              value={contactSearch}
              onChange={(event) => setContactSearch(event.target.value)}
              placeholder="Cari nama, email, atau peran..."
              className="pl-9"
            />
          </div>
          {startError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{startError}</p>
          )}
          {contacts.loading && !contacts.data && <LoadingState label="Memuat kontak..." />}
          {contacts.error && <ErrorState message={contacts.error} onRetry={contacts.refetch} />}
          {!contacts.loading && !contacts.error && filteredContacts.length === 0 && (
            <EmptyState
              title="Kontak tidak ditemukan"
              description="Coba kata kunci lain atau tambahkan akun terlebih dahulu."
            />
          )}
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => openContact(contact)}
                disabled={Boolean(starting)}
                className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-brand-100 hover:bg-brand-50/50 disabled:opacity-60"
              >
                <Avatar name={contact.name} tone={contact.role === 'courier' ? 'amber' : contact.role === 'staff' ? 'sky' : 'brand'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-900">{contact.name}</span>
                  <span className="block truncate text-xs text-ink-500">{contact.email}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={contact.role === 'courier' ? 'amber' : contact.role === 'staff' ? 'blue' : 'slate'}>
                    {roleLabels[contact.role ?? ''] ?? contact.roleLabel ?? contact.role}
                  </Badge>
                  {starting === contact.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                  ) : contact.conversationId ? (
                    <span className="text-[10px] font-semibold text-brand-600">Buka</span>
                  ) : (
                    <MessageCircle className="h-4 w-4 text-ink-300" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
