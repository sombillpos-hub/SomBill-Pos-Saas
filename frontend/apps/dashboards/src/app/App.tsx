import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@sombill/shared-hooks/AuthContext';
import { ToastProvider } from '@sombill/shared-ui/ui/Toast';
import { AppLayout } from '@sombill/manager/layouts/AppLayout';
import {
  CashierRoute,
  FullPageLoader,
  ManagerRoute,
  OwnerRoute,
  RoleHome,
  WaiterRoute,
} from '@/app/router/ProtectedRoute';
import { SuperAdminLayout } from '@sombill/super-admin/layouts/SuperAdminLayout';
import { WaiterLayout } from '@sombill/waiter/layouts/WaiterLayout';
import { CashierLayout } from '@sombill/cashier/layouts/CashierLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Manager Dashboard
const DashboardPage = lazy(() => import('@sombill/manager/pages/dashboard/DashboardPage'));
const OrdersPage = lazy(() => import('@sombill/manager/pages/orders/OrdersPage'));
const OrderDetailPage = lazy(() => import('@sombill/manager/pages/orders/OrderDetailPage'));
const ProductsPage = lazy(() => import('@sombill/manager/pages/menu/ProductsPage'));
const CategoriesPage = lazy(() => import('@sombill/manager/pages/categories/CategoriesPage'));
const TablesPage = lazy(() => import('@sombill/manager/pages/tables/TablesPage'));
const StaffPage = lazy(() => import('@sombill/manager/pages/staff/StaffPage'));
const CustomersPage = lazy(() => import('@sombill/manager/pages/customers/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@sombill/manager/pages/customers/CustomerDetailPage'));
const InventoryPage = lazy(() => import('@sombill/manager/pages/inventory/InventoryPage'));
const SuppliersPage = lazy(() => import('@sombill/manager/pages/suppliers/SuppliersPage'));
const SupplierDetailPage = lazy(() => import('@sombill/manager/pages/suppliers/SupplierDetailPage'));
const PurchaseOrdersPage = lazy(() => import('@sombill/manager/pages/purchase-orders/PurchaseOrdersPage'));
const PurchaseOrderDetailPage = lazy(() => import('@sombill/manager/pages/purchase-orders/PurchaseOrderDetailPage'));
const ExpensesPage = lazy(() => import('@sombill/manager/pages/expenses/ExpensesPage'));
const ReportsPage = lazy(() => import('@sombill/manager/pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@sombill/manager/pages/settings/SettingsPage'));

// Waiter POS
const WaiterDashboardPage = lazy(() => import('@sombill/waiter/pages/WaiterDashboardPage'));
const WaiterTablesPage = lazy(() => import('@sombill/waiter/pages/WaiterTablesPage'));
const NewOrderPage = lazy(() => import('@sombill/waiter/pages/NewOrderPage'));
const MyOrdersPage = lazy(() => import('@sombill/waiter/pages/MyOrdersPage'));
const WaiterOrderDetailPage = lazy(() => import('@sombill/waiter/pages/WaiterOrderDetailPage'));
const WaiterMenuPage = lazy(() => import('@sombill/waiter/pages/WaiterMenuPage'));
const KitchenStatusPage = lazy(() => import('@sombill/waiter/pages/KitchenStatusPage'));
const BillsPage = lazy(() => import('@sombill/waiter/pages/BillsPage'));
const NotificationsPage = lazy(() => import('@sombill/waiter/pages/NotificationsPage'));
const ProfilePage = lazy(() => import('@sombill/shared-ui/pos/ProfilePage'));

// Cashier POS
const CashierDashboardPage = lazy(() => import('@sombill/cashier/pages/CashierDashboardPage'));
const CashierTablesPage = lazy(() => import('@sombill/cashier/pages/CashierTablesPage'));
const NewSalePage = lazy(() => import('@sombill/cashier/pages/NewSalePage'));
const ActiveOrdersPage = lazy(() => import('@sombill/cashier/pages/ActiveOrdersPage'));
const CashierBillsPage = lazy(() => import('@sombill/cashier/pages/CashierBillsPage'));
const PaymentProcessingPage = lazy(() => import('@sombill/cashier/pages/PaymentProcessingPage'));
const TransactionsPage = lazy(() => import('@sombill/cashier/pages/TransactionsPage'));
const ReceiptsPage = lazy(() => import('@sombill/cashier/pages/ReceiptsPage'));
const RefundsPage = lazy(() => import('@sombill/cashier/pages/RefundsPage'));
const ShiftPage = lazy(() => import('@sombill/cashier/pages/ShiftPage'));
const PrintPage = lazy(() => import('@sombill/cashier/pages/PrintPage'));
const CustomerMenuPage = lazy(() => import('@/pages/CustomerMenuPage'));

// Super Admin / Group HQ
const HqOverviewPage = lazy(() => import('@sombill/super-admin/pages/OverviewPage'));
const HqBranchesPage = lazy(() => import('@sombill/super-admin/pages/BranchesPage'));
const HqTerminalsPage = lazy(() => import('@sombill/super-admin/pages/TerminalsPage'));
const HqRevenuePage = lazy(() => import('@sombill/super-admin/pages/RevenuePage'));
const HqTaxPage = lazy(() => import('@sombill/super-admin/pages/TaxPage'));
const HqMobileMoneyPage = lazy(() => import('@sombill/super-admin/pages/MobileMoneyPage'));
const HqLicensesPage = lazy(() => import('@sombill/super-admin/pages/LicensesPage'));
const HqMenuPushPage = lazy(() => import('@sombill/super-admin/pages/MenuPushPage'));
const HqUsersPage = lazy(() => import('@sombill/super-admin/pages/UsersPage'));
const HqInventoryPage = lazy(() => import('@sombill/super-admin/pages/InventoryPage'));
const HqAuditPage = lazy(() => import('@sombill/super-admin/pages/AuditPage'));
const HqSystemPage = lazy(() => import('@sombill/super-admin/pages/SystemPage'));
const HqSettingsPage = lazy(() => import('@sombill/super-admin/pages/SettingsPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* Auth & public customer QR menu routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ResetPasswordPage />} />
        <Route path="/table-menu" element={<CustomerMenuPage />} />
        <Route path="/table-menu/:tableId" element={<CustomerMenuPage />} />
        <Route path="/" element={<RoleHome />} />

        {/* Waiter POS */}
        <Route element={<WaiterRoute />}>
          <Route path="/waiter" element={<WaiterLayout />}>
            <Route index element={<WaiterDashboardPage />} />
            <Route path="tables" element={<WaiterTablesPage />} />
            <Route path="new-order" element={<NewOrderPage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:id" element={<WaiterOrderDetailPage />} />
            <Route path="menu" element={<WaiterMenuPage />} />
            <Route path="kitchen" element={<KitchenStatusPage />} />
            <Route path="bills" element={<BillsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        {/* Cashier POS */}
        <Route element={<CashierRoute />}>
          <Route path="/cashier-print/:kind/:id" element={<PrintPage />} />
          <Route path="/cashier" element={<CashierLayout />}>
            <Route index element={<CashierDashboardPage />} />
            <Route path="tables" element={<CashierTablesPage />} />
            <Route path="new-sale" element={<NewSalePage />} />
            <Route path="active-orders" element={<ActiveOrdersPage />} />
            <Route path="bills" element={<CashierBillsPage />} />
            <Route path="payments" element={<PaymentProcessingPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="shift" element={<ShiftPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        {/* Super Admin / Group HQ: accessible at both /super-admin and /dashboard/super-admin */}
        <Route element={<OwnerRoute />}>
          <Route path="/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<HqOverviewPage />} />
            <Route path="branches" element={<HqBranchesPage />} />
            <Route path="terminals" element={<HqTerminalsPage />} />
            <Route path="revenue" element={<HqRevenuePage />} />
            <Route path="tax" element={<HqTaxPage />} />
            <Route path="mobile-money" element={<HqMobileMoneyPage />} />
            <Route path="licenses" element={<HqLicensesPage />} />
            <Route path="menu-push" element={<HqMenuPushPage />} />
            <Route path="users" element={<HqUsersPage />} />
            <Route path="inventory" element={<HqInventoryPage />} />
            <Route path="audit" element={<HqAuditPage />} />
            <Route path="system" element={<HqSystemPage />} />
            <Route path="settings" element={<HqSettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/dashboard/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<HqOverviewPage />} />
            <Route path="branches" element={<HqBranchesPage />} />
            <Route path="terminals" element={<HqTerminalsPage />} />
            <Route path="revenue" element={<HqRevenuePage />} />
            <Route path="tax" element={<HqTaxPage />} />
            <Route path="mobile-money" element={<HqMobileMoneyPage />} />
            <Route path="licenses" element={<HqLicensesPage />} />
            <Route path="menu-push" element={<HqMenuPushPage />} />
            <Route path="users" element={<HqUsersPage />} />
            <Route path="inventory" element={<HqInventoryPage />} />
            <Route path="audit" element={<HqAuditPage />} />
            <Route path="system" element={<HqSystemPage />} />
            <Route path="settings" element={<HqSettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        {/* Manager Dashboard: accessible at both /manager and /dashboard */}
        <Route element={<ManagerRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/manager" element={<DashboardPage />} />
            <Route path="/manager/dashboard" element={<DashboardPage />} />
            <Route path="/manager/orders" element={<OrdersPage />} />
            <Route path="/manager/orders/:id" element={<OrderDetailPage />} />
            <Route path="/manager/menu" element={<ProductsPage />} />
            <Route path="/manager/categories" element={<CategoriesPage />} />
            <Route path="/manager/tables" element={<TablesPage />} />
            <Route path="/manager/staff" element={<StaffPage />} />
            <Route path="/manager/customers" element={<CustomersPage />} />
            <Route path="/manager/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/manager/inventory" element={<InventoryPage />} />
            <Route path="/manager/suppliers" element={<SuppliersPage />} />
            <Route path="/manager/suppliers/:id" element={<SupplierDetailPage />} />
            <Route path="/manager/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/manager/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
            <Route path="/manager/expenses" element={<ExpensesPage />} />
            <Route path="/manager/reports" element={<ReportsPage />} />
            <Route path="/manager/settings" element={<SettingsPage />} />

            <Route path="/dashboard" element={<Navigate to="/manager" replace />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/menu" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
