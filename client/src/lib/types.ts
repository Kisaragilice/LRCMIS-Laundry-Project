export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isPrimaryAdmin?: boolean;
  deletedAt?: string | null;
  roles: string[];
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pricingUnit: 'kg' | 'piece' | 'pair';
  estimatedHours: number | null;
  isActive: boolean;
  usageCount?: number;
}

export interface Address {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
}

export interface TimeSlot {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reserved: number;
  remaining: number;
  isAvailable: boolean;
  rawAvailable?: boolean;
}

export interface ReservationItem {
  id: string;
  serviceId: string;
  name?: string;
  price?: number;
  pricingUnit?: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  reservationCode: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  pickupType: 'drop_off' | 'pickup';
  notes: string | null;
  customerId: string;
  customer?: { id: string; name: string; email: string; phone: string | null };
  address: Address | null;
  timeSlot: { id: string; slotDate: string; startTime: string; endTime: string; startsAt: string; endsAt: string };
  items: ReservationItem[];
  order: { id: string; orderCode: string; orderStatus: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
  unit: string;
  lineTotal: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  referenceCode: string | null;
  notes: string | null;
  refundNote: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  verifiedBy: string | null;
  order?: {
    id: string;
    orderCode: string;
    orderStatus: string;
    totalAmount: number;
    customer?: { id: string; name: string; email: string };
  };
}

export interface TimelineEntry {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  notes: string | null;
  createdAt: string;
  changedBy: { id: string; name: string } | null;
}

export interface DeliveryTask {
  id: string;
  orderId: string;
  taskType: 'pickup' | 'delivery';
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'failed';
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
  courier: { id: string; name: string; email: string; phone: string | null } | null;
  handoverRecipient: string | null;
  handoverConfirmedAt: string | null;
  addressSnapshot: string | null;
  contactPhone: string | null;
  order?: {
    id: string;
    orderCode: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    customer?: { id: string; name: string; email: string; phone: string | null };
    reservation?: {
      pickupType: string;
      timeSlot: { id: string; slotDate: string; startTime: string; endTime: string; startsAt: string; endsAt: string };
    } | null;
    address?: Address | null;
  };
}

export interface Order {
  id: string;
  orderCode: string;
  invoiceNumber: string;
  orderStatus: string;
  paymentStatus: string;
  actualWeight: number | null;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  customer?: { id: string; name: string; email: string; phone: string | null };
  assignedStaff: { id: string; name: string; email: string; phone: string | null } | null;
  reservation: {
    id: string;
    reservationCode: string;
    pickupType: string;
    address: Address | null;
    timeSlot: { id: string; slotDate: string; startTime: string; endTime: string; startsAt: string; endsAt: string };
  } | null;
  items: OrderItem[];
  timeline: TimelineEntry[];
  payments: Payment[];
  deliveryTasks: DeliveryTask[];
  review: { rating: number; comment: string | null } | null;
}

export interface Promotion {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase: number;
  maxDiscount: number | null;
  perUserLimit?: number;
  startAt: string;
  endAt: string;
  usageLimit: number | null;
  isActive: boolean;
  usageCount?: number;
  remainingQuota?: number | null;
  eligible?: boolean;
  reason?: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  orderId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ChatCounterpart {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
}

export interface ChatConversation {
  id: string;
  type: 'admin_customer' | 'admin_staff' | 'admin_courier' | 'courier_customer';
  title: string;
  subtitle: string;
  counterpart: ChatCounterpart | null;
  order: { id: string; orderCode: string; orderStatus: string } | null;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  } | null;
  unread: number;
  canSend: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface ChatThread {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

export interface ChatContact extends ChatCounterpart {
  roleLabel: string | null;
  conversationId: string | null;
}

export interface DeliveryChatContact {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  counterpart: { id: string; name: string; phone: string | null };
  conversationId: string | null;
}

export interface Complaint {
  id: string;
  code: string;
  customerId: string;
  orderId: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
  order?: { id: string; orderCode: string } | null;
  followUps?: Array<{ id: string; note: string; createdAt: string; user: { name: string } }>;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName?: string;
  service?: string;
  user?: { id: string; name: string; email: string };
  order?: { id: string; orderCode: string; items: Array<{ serviceNameSnapshot: string }> };
}

export interface DashboardData {
  revenue: {
    summary: {
      grossRevenue: number;
      refunds: number;
      netRevenue: number;
      paidTransactions: number;
      completedOrders: number;
      totalOrders: number;
      averageOrderValue: number;
    };
    series: Array<{ period: string; revenue: number; refunds: number; transactions: number }>;
  };
  orders: {
    summary: {
      totalOrders: number;
      completedOrders: number;
      cancelledOrders: number;
      activeOrders: number;
      totalOrderValue: number;
      completionRate: number;
    };
    byStatus: Array<{ status: string; count: number }>;
    series: Array<{ period: string; orders: number; completed: number; value: number }>;
  };
  popularServices: Array<{ serviceId: string; name: string; pricingUnit: string; orderCount: number; quantity: number; value: number }>;
  customers: { summary: { activeCustomers: number; newCustomers: number; repeatCustomers: number; averageOrdersPerCustomer: number } };
  operations: { summary: { averageCompletionHours: number; pendingReservations: number; unassignedDeliveryTasks: number; completedOrders: number } };
  recentOrders: Array<{
    id: string; orderCode: string; orderStatus: string; paymentStatus?: string; totalAmount: string | number; createdAt: string;
    itemCount?: number;
    customer?: { name: string };
  }>;
  pendingReservations: Reservation[];
  pendingPayments: Array<Payment & { order?: { id?: string; orderCode: string; orderStatus?: string; totalAmount?: number; customer?: { name: string } } }>;
  reviews: { averageRating: number | null; total: number };
  upcomingSlots: TimeSlot[];
}

export interface ReportRevenue {
  period: { from: string; to: string; groupBy: string };
  summary: {
    grossRevenue: number; refunds: number; netRevenue: number; paidTransactions: number;
    refundTransactions: number; totalOrders: number; completedOrders: number;
    completedOrderValue: number; averageOrderValue: number;
  };
  series: Array<{ period: string; revenue: number; refunds: number; transactions: number }>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  recentPayments: Array<{ id: string; orderCode: string; amount: number; method: string; paidAt: string; referenceCode: string | null }>;
  empty: boolean;
}

export interface AppConfig {
  businessTimezone: string;
  minWeightKg: number;
  weightRoundingKg: number;
  defaultDeliveryFee: number;
  reservationCancelCutoffHours: number;
}
