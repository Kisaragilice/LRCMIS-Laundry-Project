import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardRedirect, GuestOnly, ProtectedRoute } from './components/layout/ProtectedRoute';
import { HomePage } from './pages/public/HomePage';
import { ServicesPage } from './pages/public/ServicesPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { ContactPage } from './pages/public/ContactPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CustomerDashboardPage } from './pages/customer/CustomerDashboardPage';
import { NewReservationPage } from './pages/customer/NewReservationPage';
import { ReservationsPage } from './pages/customer/ReservationsPage';
import { OrdersPage } from './pages/customer/OrdersPage';
import { PaymentsPage } from './pages/customer/PaymentsPage';
import { VouchersPage } from './pages/customer/VouchersPage';
import { ReviewsPage } from './pages/customer/ReviewsPage';
import { ComplaintsPage } from './pages/customer/ComplaintsPage';
import { ProfilePage } from './pages/customer/ProfilePage';
import { NotificationsPage } from './pages/shared/NotificationsPage';
import { ChatPage } from './pages/shared/ChatPage';
import { OrderDetailPage } from './pages/shared/OrderDetailPage';
import { PasswordPage } from './pages/shared/PasswordPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminTasksPage } from './pages/admin/AdminTasksPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminAccountsPage } from './pages/admin/AdminAccountsPage';
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage';
import { AdminServicesPage } from './pages/admin/AdminServicesPage';
import { AdminSlotsPage } from './pages/admin/AdminSlotsPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminComplaintsPage } from './pages/admin/AdminComplaintsPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminHistoryResetPage } from './pages/admin/AdminHistoryResetPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { CourierDashboardPage } from './pages/courier/CourierDashboardPage';
import { CourierTaskDetailPage } from './pages/courier/CourierTaskDetailPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="layanan" element={<ServicesPage />} />
        <Route path="cara-kerja" element={<HowItWorksPage />} />
        <Route path="kontak" element={<ContactPage />} />
        <Route
          path="login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route path="lupa-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route path="dashboard-redirect" element={<DashboardRedirect />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="notifikasi" element={<NotificationsPage />} />
        <Route path="ubah-password" element={<PasswordPage />} />
        <Route
          path="chat"
          element={
            <ProtectedRoute roles={['admin', 'customer', 'staff', 'courier']}>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={['customer']}>
              <CustomerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reservasi/baru"
          element={
            <ProtectedRoute roles={['customer']}>
              <NewReservationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reservasi"
          element={
            <ProtectedRoute roles={['customer']}>
              <ReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pesanan"
          element={
            <ProtectedRoute roles={['customer']}>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pesanan/:id"
          element={
            <ProtectedRoute roles={['customer']}>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pembayaran"
          element={
            <ProtectedRoute roles={['customer']}>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="voucher"
          element={
            <ProtectedRoute roles={['customer']}>
              <VouchersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="ulasan"
          element={
            <ProtectedRoute roles={['customer']}>
              <ReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="keluhan"
          element={
            <ProtectedRoute roles={['customer']}>
              <ComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profil"
          element={
            <ProtectedRoute roles={['customer', 'admin']}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reservasi"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pesanan"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pesanan/:id"
          element={
            <ProtectedRoute roles={['admin']}>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pembayaran"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/tugas"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pelanggan"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminCustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/akun"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminAccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pelanggan/:id"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminCustomerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/layanan"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminServicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/slot"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminSlotsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/promo"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPromotionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/keluhan"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminComplaintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/ulasan"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/laporan"
          element={
            <ProtectedRoute roles={['admin', 'owner']}>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminAuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reset-riwayat"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminHistoryResetPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="owner"
          element={
            <ProtectedRoute roles={['owner']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="owner/laporan"
          element={
            <ProtectedRoute roles={['owner', 'admin']}>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="staff"
          element={
            <ProtectedRoute roles={['staff']}>
              <StaffDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="staff/pesanan/:id"
          element={
            <ProtectedRoute roles={['staff']}>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="courier"
          element={
            <ProtectedRoute roles={['courier']}>
              <CourierDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="courier/tugas/:id"
          element={
            <ProtectedRoute roles={['courier']}>
              <CourierTaskDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
