/**
 * Hand-maintained OpenAPI 3.0 document. It intentionally stays close to the
 * actual Express routes; integration tests assert that documented paths exist.
 */
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'LRCMIS API',
    version: '1.0.0',
    description:
      'REST API untuk Laundry Reservation and Customer Management Information System. Autentikasi menggunakan cookie HttpOnly; permintaan yang mengubah data wajib menyertakan header X-CSRF-Token yang nilainya sama dengan cookie lrcmis_csrf.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Auth' },
    { name: 'Public' },
    { name: 'Customer' },
    { name: 'Admin' },
    { name: 'Staff' },
    { name: 'Courier' },
    { name: 'Owner' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'lrcmis_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Service: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: { type: 'number', example: 8000 },
          pricingUnit: { type: 'string', enum: ['kg', 'piece', 'pair'] },
          estimatedHours: { type: 'integer', nullable: true },
          isActive: { type: 'boolean' },
        },
      },
      ReservationInput: {
        type: 'object',
        required: ['timeSlotId', 'pickupType', 'items'],
        properties: {
          timeSlotId: { type: 'string', format: 'uuid' },
          pickupType: { type: 'string', enum: ['drop_off', 'pickup'] },
          addressId: { type: 'string', format: 'uuid', nullable: true },
          notes: { type: 'string', nullable: true },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['serviceId'],
              properties: {
                serviceId: { type: 'string', format: 'uuid' },
                quantity: { type: 'number', default: 1 },
              },
            },
          },
        },
      },
      PaymentInput: {
        type: 'object',
        required: ['amount', 'method'],
        properties: {
          amount: { type: 'number', example: 41000 },
          method: { type: 'string', enum: ['cash', 'bank_transfer'] },
          referenceCode: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
        },
      },
    },
    parameters: {
      id: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      page: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      from: { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
      to: { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
    },
    responses: {
      Unauthorized: { description: 'Belum terautentikasi', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Forbidden: { description: 'Tidak memiliki izin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound: { description: 'Data tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Conflict: { description: 'Konflik bisnis (kapasitas penuh, duplikasi, transisi tidak sah)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Validation: { description: 'Input tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    '/health': { get: { tags: ['Public'], summary: 'Health check', security: [], responses: { '200': { description: 'OK' } } } },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Registrasi akun pelanggan', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, phone: { type: 'string' } } } } } },
        responses: { '201': { description: 'Akun dibuat' }, '400': { $ref: '#/components/responses/Validation' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { '200': { description: 'Cookie sesi dan CSRF diterbitkan' }, '401': { $ref: '#/components/responses/Unauthorized' }, '429': { description: 'Rate limited' } },
      },
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Logout dan hapus cookie', responses: { '200': { description: 'OK' } } } },
    '/auth/csrf': { get: { tags: ['Auth'], summary: 'Terbitkan token CSRF', security: [], responses: { '200': { description: 'OK' } } } },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'], summary: 'Buat token reset password', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } } } },
        responses: { '200': { description: 'Respons generik; token hanya dikembalikan pada mode demo' } },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['Auth'], summary: 'Reset password dengan token', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { '200': { description: 'Password diperbarui' }, '400': { $ref: '#/components/responses/Validation' } },
      },
    },
    '/users/me': {
      get: { tags: ['Auth'], summary: 'Profil pengguna aktif', responses: { '200': { description: 'Profil' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      patch: { tags: ['Auth'], summary: 'Perbarui profil', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } } } } }, responses: { '200': { description: 'Diperbarui' } } },
    },
    '/users/me/password': { patch: { tags: ['Auth'], summary: 'Ubah password', responses: { '200': { description: 'OK' } } } },
    '/users/me/addresses': {
      get: { tags: ['Customer'], summary: 'Daftar alamat sendiri', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Customer'], summary: 'Tambah alamat', responses: { '201': { description: 'Dibuat' } } },
    },
    '/users/me/addresses/{id}': {
      patch: { tags: ['Customer'], summary: 'Ubah alamat', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } },
      delete: { tags: ['Customer'], summary: 'Hapus alamat', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } },
    },
    '/services': { get: { tags: ['Public'], summary: 'Katalog layanan aktif', security: [], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Service' } } } } } } } } } },
    '/config': { get: { tags: ['Public'], summary: 'Kebijakan bisnis publik (minimum berat, fee, zona waktu)', security: [], responses: { '200': { description: 'OK' } } } },
    '/time-slots': { get: { tags: ['Customer'], summary: 'Slot tersedia dengan sisa kapasitas', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/reservations': { post: { tags: ['Customer'], summary: 'Buat reservasi (kapasitas dikunci dalam transaksi)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReservationInput' } } } }, responses: { '201': { description: 'Dibuat' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/reservations/me': { get: { tags: ['Customer'], summary: 'Reservasi sendiri', responses: { '200': { description: 'OK' } } } },
    '/reservations/{id}': { get: { tags: ['Customer'], summary: 'Detail reservasi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' } } } },
    '/reservations/{id}/cancel': { patch: { tags: ['Customer'], summary: 'Batalkan reservasi yang memenuhi syarat', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/orders/me': { get: { tags: ['Customer'], summary: 'Pesanan sendiri beserta timeline', responses: { '200': { description: 'OK' } } } },
    '/orders/{id}': { get: { tags: ['Customer'], summary: 'Detail pesanan (owner/ADMIN/staff ditugaskan/kurir ditugaskan)', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' } } } },
    '/orders/{id}/payments': {
      get: { tags: ['Customer'], summary: 'Riwayat pembayaran pesanan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } },
      post: {
        tags: ['Admin'], summary: 'Catat pembayaran (wajib header Idempotency-Key)', parameters: [{ $ref: '#/components/parameters/id' }, { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentInput' } } } },
        responses: { '201': { description: 'Dibuat' }, '200': { description: 'Idempotent replay' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/orders/{id}/reviews': { post: { tags: ['Customer'], summary: 'Ulasan pesanan selesai (satu per pesanan)', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/orders/{id}/complaints': { post: { tags: ['Customer'], summary: 'Ajukan keluhan untuk pesanan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' } } } },
    '/notifications/me': { get: { tags: ['Customer'], summary: 'Notifikasi dalam aplikasi', parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }], responses: { '200': { description: 'OK' } } } },
    '/notifications/me/unread-count': { get: { tags: ['Customer'], summary: 'Jumlah notifikasi belum dibaca', responses: { '200': { description: 'OK' } } } },
    '/notifications/{id}/read': { patch: { tags: ['Customer'], summary: 'Tandai notifikasi dibaca', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/notifications/read-all': { patch: { tags: ['Customer'], summary: 'Tandai semua dibaca', responses: { '200': { description: 'OK' } } } },
    '/promotions': { get: { tags: ['Customer'], summary: 'Voucher aktif dan kelayakan', responses: { '200': { description: 'OK' } } } },
    '/promotions/validate': { post: { tags: ['Customer'], summary: 'Validasi voucher terhadap subtotal', responses: { '200': { description: 'OK' }, '400': { $ref: '#/components/responses/Validation' } } } },
    '/complaints': { post: { tags: ['Customer'], summary: 'Buat keluhan', responses: { '201': { description: 'Dibuat' } } } },
    '/complaints/me': { get: { tags: ['Customer'], summary: 'Keluhan sendiri', responses: { '200': { description: 'OK' } } } },
    '/reviews/featured': { get: { tags: ['Public'], summary: 'Ulasan unggulan untuk beranda', security: [], responses: { '200': { description: 'OK' } } } },

    '/admin/dashboard': { get: { tags: ['Admin', 'Owner'], summary: 'Statistik dashboard operasional & pendapatan', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/revenue': { get: { tags: ['Admin', 'Owner'], summary: 'Laporan pendapatan berbasis pembayaran terverifikasi', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }, { name: 'groupBy', in: 'query', schema: { type: 'string', enum: ['day', 'month'] } }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/orders': { get: { tags: ['Admin', 'Owner'], summary: 'Laporan jumlah dan status pesanan', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/services': { get: { tags: ['Admin', 'Owner'], summary: 'Layanan populer', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/customers': { get: { tags: ['Admin', 'Owner'], summary: 'Metrik pelanggan aktif', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/operations': { get: { tags: ['Admin', 'Owner'], summary: 'Kinerja operasional', parameters: [{ $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reports/export': { get: { tags: ['Admin', 'Owner'], summary: 'Ekspor CSV', parameters: [{ name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['revenue', 'orders', 'services', 'customers'] } }, { $ref: '#/components/parameters/from' }, { $ref: '#/components/parameters/to' }], responses: { '200': { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } } } } },
    '/admin/audit-logs': { get: { tags: ['Admin'], summary: 'Audit log aktivitas penting', responses: { '200': { description: 'OK' } } } },
    '/admin/services': {
      get: { tags: ['Admin'], summary: 'Semua layanan termasuk nonaktif', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Buat layanan', responses: { '201': { description: 'Dibuat' } } },
    },
    '/admin/services/{id}': { patch: { tags: ['Admin'], summary: 'Ubah layanan/harga (snapshot lama tetap)', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } }, delete: { tags: ['Admin'], summary: 'Hapus layanan tanpa transaksi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/services/{id}/deactivate': { patch: { tags: ['Admin'], summary: 'Nonaktifkan layanan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/time-slots': {
      get: { tags: ['Admin'], summary: 'Daftar slot dan okupansi', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Buat slot', responses: { '201': { description: 'Dibuat' } } },
    },
    '/admin/time-slots/{id}': {
      patch: { tags: ['Admin'], summary: 'Ubah kapasitas/ketersediaan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } },
      delete: { tags: ['Admin'], summary: 'Hapus slot tanpa reservasi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } },
    },
    '/admin/customers': { get: { tags: ['Admin'], summary: 'Daftar pelanggan', parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }], responses: { '200': { description: 'OK' } } } },
    '/admin/customers/{id}': { get: { tags: ['Admin'], summary: 'Detail pelanggan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/customers/{id}/status': { patch: { tags: ['Admin'], summary: 'Aktif/nonaktifkan pelanggan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/staff': { get: { tags: ['Admin'], summary: 'Daftar staff dan kurir', responses: { '200': { description: 'OK' } } } },
    '/admin/reservations': { get: { tags: ['Admin'], summary: 'Reservasi dengan filter', responses: { '200': { description: 'OK' } } } },
    '/admin/reservations/{id}/confirm': { patch: { tags: ['Admin'], summary: 'Konfirmasi reservasi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reservations/{id}/cancel': { patch: { tags: ['Admin'], summary: 'Batalkan reservasi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reservations/{id}/orders': { post: { tags: ['Admin'], summary: 'Konversi reservasi terkonfirmasi menjadi pesanan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/admin/orders': { get: { tags: ['Admin'], summary: 'Semua pesanan dengan filter', responses: { '200': { description: 'OK' } } } },
    '/admin/orders/{id}/receive': { post: { tags: ['Admin'], summary: 'Terima, timbang, hitung total, terapkan voucher', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/admin/orders/{id}/status': { patch: { tags: ['Admin'], summary: 'Ubah status dengan validasi transisi', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/admin/orders/{id}/assign': { patch: { tags: ['Admin'], summary: 'Tugaskan staff', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/orders/{id}/notes': { get: { tags: ['Admin'], summary: 'Catatan operasional', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } }, post: { tags: ['Admin'], summary: 'Tambah catatan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' } } } },
    '/admin/orders/{id}/tasks': { post: { tags: ['Admin'], summary: 'Buat tugas pickup/delivery', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' } } } },
    '/admin/delivery-tasks': { get: { tags: ['Admin'], summary: 'Semua tugas pengantaran', responses: { '200': { description: 'OK' } } } },
    '/admin/delivery-tasks/{id}/assign': { patch: { tags: ['Admin'], summary: 'Tugaskan kurir', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/payments': { get: { tags: ['Admin'], summary: 'Daftar pembayaran', responses: { '200': { description: 'OK' } } } },
    '/admin/payments/{id}/verify': { patch: { tags: ['Admin'], summary: 'Verifikasi transfer manual', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' } } } },
    '/admin/payments/{id}/reject': { patch: { tags: ['Admin'], summary: 'Tolak pembayaran pending', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/payments/{id}/refund': { patch: { tags: ['Admin'], summary: 'Refund tanpa menghapus riwayat', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/promotions': { get: { tags: ['Admin'], summary: 'Semua voucher', responses: { '200': { description: 'OK' } } }, post: { tags: ['Admin'], summary: 'Buat voucher', responses: { '201': { description: 'Dibuat' } } } },
    '/admin/promotions/{id}': { patch: { tags: ['Admin'], summary: 'Ubah voucher', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/reviews': { get: { tags: ['Admin'], summary: 'Semua ulasan', responses: { '200': { description: 'OK' } } } },
    '/admin/complaints': { get: { tags: ['Admin'], summary: 'Semua keluhan', responses: { '200': { description: 'OK' } } } },
    '/admin/complaints/{id}': { patch: { tags: ['Admin'], summary: 'Ubah status/resolusi keluhan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' } } } },
    '/admin/complaints/{id}/follow-ups': { post: { tags: ['Admin'], summary: 'Catat tindak lanjut', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' } } } },

    '/staff/orders': { get: { tags: ['Staff'], summary: 'Pesanan yang ditugaskan', responses: { '200': { description: 'OK' } } } },
    '/staff/orders/{id}': { get: { tags: ['Staff'], summary: 'Detail pesanan yang ditugaskan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' } } } },
    '/staff/orders/{id}/status': { patch: { tags: ['Staff'], summary: 'Perbarui status operasional yang diizinkan', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' }, '409': { $ref: '#/components/responses/Conflict' } } } },
    '/staff/orders/{id}/notes': { post: { tags: ['Staff'], summary: 'Catatan operasional', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '201': { description: 'Dibuat' } } } },

    '/courier/tasks': { get: { tags: ['Courier'], summary: 'Tugas kurir sendiri', responses: { '200': { description: 'OK' } } } },
    '/courier/tasks/{id}': { get: { tags: ['Courier'], summary: 'Detail tugas + alamat', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '403': { $ref: '#/components/responses/Forbidden' } } } },
    '/courier/tasks/{id}/status': { patch: { tags: ['Courier'], summary: 'Perbarui status tugas dan serah terima', parameters: [{ $ref: '#/components/parameters/id' }], responses: { '200': { description: 'OK' }, '409': { $ref: '#/components/responses/Conflict' } } } },
  },
};
