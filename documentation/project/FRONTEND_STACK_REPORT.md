# FRONTEND_STACK_REPORT: frontend stack and feature-based structure

_22 Nov 2026. Applies the "SomBill – Frontend Technology Stack & Implementation" brief. Hotel management is out of
scope; new business modules (Kitchen, Inventory, HR, Finance) are not built in this step._

## 1. What changed

| Area | Change |
| --- | --- |
| Dashboards structure | Moved to a feature-based `src/` (brief §11): `app/`, `features/{auth,manager,waiter,cashier,pos}`, `api/`, `components/`, `config/`, `constants/`, `contexts/`, `hooks/`, `pages/`, `schemas/`, `services/`, `stores/`, `styles/`, `test/`, `types/`, `utilities/`; static files in `public/`. 121 files moved; 92 had import lines rewritten automatically (every specifier resolved against the old tree and re-pointed) |
| Packages (dashboards) | Added framer-motion, zustand, @tanstack/react-query, @tanstack/react-table, axios, socket.io-client, recharts, date-fns; dev: prettier, eslint-config-prettier |
| Packages (website) | Added prettier (dev). Framer Motion, Lucide and Tailwind were already present |
| New code (dashboards) | `config/env.ts`, `api/httpClient.ts`, `api/queryClient.ts`, `api/socket.ts`, `stores/sessionStore.ts`, `hooks/useSocketEvent.ts`, `app/providers/AppProviders.tsx`, `components/motion/Motion.tsx`, tests `api/__tests__/httpClient.test.ts` and `socket.test.tsx` (11 tests) |
| Wiring | `main.tsx` wraps the app in `AppProviders` (TanStack Query, Framer Motion `reducedMotion="user"`, cache clear on session expiry) |
| Config | `@/` alias → `src/`; tsconfig include `src`; Tailwind content `src/**`; Vite `publicDir` default (`public/`), test include `src/**`, new `query` chunk; ESLint extends `eslint-config-prettier`; `index.html` → `/src/app/main.tsx`; `.env.example` gained `VITE_API_*` and `VITE_SOCKET_*` |
| Formatting | Shared `frontend/.prettierrc.json`; both apps formatted once; `format` / `format:check` scripts in each app and at the root; `verify-all.sh` checks formatting |
| Lint fix | `OrdersPage.tsx`: an `eslint-disable-line` comment that Prettier moved off its line became `eslint-disable-next-line` (same rule, same line) |
| Docs | New `documentation/architecture/frontend-architecture.md`; README, ARCHITECTURE, PROJECT_STATUS and module-guide path notes updated |

No route, page, API call, database interaction or visual design changed.

## 2. Verification

| Check | Result |
| --- | --- |
| Pure folder move (before adding packages) | Dashboards production build **byte-identical** to the previous build |
| After Prettier | Both builds compared with the pre-format builds: the only differences are JSX text split into adjacent string literals (e.g. `"due "` → `"due", " "`), which render identical text. Website CSS byte-identical |
| TypeScript strict (`tsc -b`, dashboards; `tsc --noEmit`, website and backend) | ✅ 0 errors |
| ESLint dashboards (`--max-warnings=0`, `no-explicit-any: error`) | ✅ 0 problems |
| Prettier `format:check` (website + dashboards) | ✅ |
| Vitest | ✅ dashboards 17 files / 200 tests (189 existing + 11 new); backend 1 file / 9 tests |
| Production builds | ✅ website and dashboards |
| Real-Chrome tablet and 80mm receipt check | ✅ see the final run below |
| Database tests (unchanged backend) | ✅ see the final run below |

## 3. Not done, and why

- **Website ESLint:** `typescript-eslint` supports TypeScript < 6.1; the website uses TypeScript 7.0.2. Downgrading the
  compiler only to add a linter would change the website's stack. `tsc` still type-checks it. Revisit when
  `typescript-eslint` supports TS 7.
- **Website routing stays custom** (not React Router): see `FRONTEND_STACK.md` §5.
- **Existing screens are not migrated to Axios, Socket.IO, Recharts or TanStack Table.** They work on Supabase, and the
  brief says not to rebuild working pages. The new layer is used by new modules, and by existing screens once the
  backend stack is decided.
- **Hotel and housekeeping:** out of scope by decision.

## 4. Every file moved (frontend/dashboards)

| From | To |
| --- | --- |
| `cashier/__tests__/cashierLogic.test.ts` | `src/features/cashier/__tests__/cashierLogic.test.ts` |
| `cashier/__tests__/cashierNavigation.test.tsx` | `src/features/cashier/__tests__/cashierNavigation.test.tsx` |
| `cashier/__tests__/cashierWorkflows.test.tsx` | `src/features/cashier/__tests__/cashierWorkflows.test.tsx` |
| `cashier/components/BillDetail.tsx` | `src/features/cashier/components/BillDetail.tsx` |
| `cashier/components/PaymentPanel.tsx` | `src/features/cashier/components/PaymentPanel.tsx` |
| `cashier/components/ReceiptView.tsx` | `src/features/cashier/components/ReceiptView.tsx` |
| `cashier/hooks/useReceiptData.ts` | `src/features/cashier/hooks/useReceiptData.ts` |
| `cashier/hooks/useShift.ts` | `src/features/cashier/hooks/useShift.ts` |
| `cashier/layouts/CashierLayout.tsx` | `src/features/cashier/layouts/CashierLayout.tsx` |
| `cashier/navigation.ts` | `src/features/cashier/navigation.ts` |
| `cashier/pages/ActiveOrdersPage.tsx` | `src/features/cashier/pages/ActiveOrdersPage.tsx` |
| `cashier/pages/CashierBillsPage.tsx` | `src/features/cashier/pages/CashierBillsPage.tsx` |
| `cashier/pages/CashierDashboardPage.tsx` | `src/features/cashier/pages/CashierDashboardPage.tsx` |
| `cashier/pages/NewSalePage.tsx` | `src/features/cashier/pages/NewSalePage.tsx` |
| `cashier/pages/PaymentProcessingPage.tsx` | `src/features/cashier/pages/PaymentProcessingPage.tsx` |
| `cashier/pages/PrintPage.tsx` | `src/features/cashier/pages/PrintPage.tsx` |
| `cashier/pages/ReceiptsPage.tsx` | `src/features/cashier/pages/ReceiptsPage.tsx` |
| `cashier/pages/RefundsPage.tsx` | `src/features/cashier/pages/RefundsPage.tsx` |
| `cashier/pages/ShiftPage.tsx` | `src/features/cashier/pages/ShiftPage.tsx` |
| `cashier/pages/TransactionsPage.tsx` | `src/features/cashier/pages/TransactionsPage.tsx` |
| `cashier/services/data.ts` | `src/features/cashier/services/data.ts` |
| `cashier/services/escpos.ts` | `src/features/cashier/services/escpos.ts` |
| `cashier/utilities/payment.ts` | `src/features/cashier/utilities/payment.ts` |
| `cashier/utilities/receiptModel.ts` | `src/features/cashier/utilities/receiptModel.ts` |
| `cashier/utilities/stats.ts` | `src/features/cashier/utilities/stats.ts` |
| `manager/__tests__/managerNavigation.test.tsx` | `src/features/manager/__tests__/managerNavigation.test.tsx` |
| `manager/__tests__/managerWorkflows.test.tsx` | `src/features/manager/__tests__/managerWorkflows.test.tsx` |
| `manager/components/BarChart.tsx` | `src/features/manager/components/BarChart.tsx` |
| `manager/components/ImageUpload.tsx` | `src/features/manager/components/ImageUpload.tsx` |
| `manager/components/ProductFormModal.tsx` | `src/features/manager/components/ProductFormModal.tsx` |
| `manager/components/RecipeModal.tsx` | `src/features/manager/components/RecipeModal.tsx` |
| `manager/layouts/AppLayout.tsx` | `src/features/manager/layouts/AppLayout.tsx` |
| `manager/navigation.ts` | `src/features/manager/navigation.ts` |
| `manager/pages/categories/CategoriesPage.tsx` | `src/features/manager/pages/categories/CategoriesPage.tsx` |
| `manager/pages/customers/CustomerDetailPage.tsx` | `src/features/manager/pages/customers/CustomerDetailPage.tsx` |
| `manager/pages/customers/CustomersPage.tsx` | `src/features/manager/pages/customers/CustomersPage.tsx` |
| `manager/pages/dashboard/DashboardPage.tsx` | `src/features/manager/pages/dashboard/DashboardPage.tsx` |
| `manager/pages/expenses/ExpensesPage.tsx` | `src/features/manager/pages/expenses/ExpensesPage.tsx` |
| `manager/pages/inventory/InventoryPage.tsx` | `src/features/manager/pages/inventory/InventoryPage.tsx` |
| `manager/pages/menu/ProductsPage.tsx` | `src/features/manager/pages/menu/ProductsPage.tsx` |
| `manager/pages/orders/OrderDetailPage.tsx` | `src/features/manager/pages/orders/OrderDetailPage.tsx` |
| `manager/pages/orders/OrdersPage.tsx` | `src/features/manager/pages/orders/OrdersPage.tsx` |
| `manager/pages/purchase-orders/PurchaseOrderDetailPage.tsx` | `src/features/manager/pages/purchase-orders/PurchaseOrderDetailPage.tsx` |
| `manager/pages/purchase-orders/PurchaseOrdersPage.tsx` | `src/features/manager/pages/purchase-orders/PurchaseOrdersPage.tsx` |
| `manager/pages/reports/ReportsPage.tsx` | `src/features/manager/pages/reports/ReportsPage.tsx` |
| `manager/pages/settings/SettingsPage.tsx` | `src/features/manager/pages/settings/SettingsPage.tsx` |
| `manager/pages/staff/StaffPage.tsx` | `src/features/manager/pages/staff/StaffPage.tsx` |
| `manager/pages/suppliers/SupplierDetailPage.tsx` | `src/features/manager/pages/suppliers/SupplierDetailPage.tsx` |
| `manager/pages/suppliers/SuppliersPage.tsx` | `src/features/manager/pages/suppliers/SuppliersPage.tsx` |
| `manager/pages/tables/TablesPage.tsx` | `src/features/manager/pages/tables/TablesPage.tsx` |
| `routing/App.tsx` | `src/app/App.tsx` |
| `routing/ProtectedRoute.tsx` | `src/app/router/ProtectedRoute.tsx` |
| `routing/main.tsx` | `src/app/main.tsx` |
| `routing/vite-env.d.ts` | `src/vite-env.d.ts` |
| `shared/assets/branding/README.md` | `public/branding/README.md` |
| `shared/auth/AuthContext.tsx` | `src/contexts/AuthContext.tsx` |
| `shared/auth/__tests__/auth.test.tsx` | `src/features/auth/__tests__/auth.test.tsx` |
| `shared/auth/__tests__/authProvider.test.tsx` | `src/features/auth/__tests__/authProvider.test.tsx` |
| `shared/auth/pages/AccessDeniedPage.tsx` | `src/features/auth/pages/AccessDeniedPage.tsx` |
| `shared/auth/pages/LoginPage.tsx` | `src/features/auth/pages/LoginPage.tsx` |
| `shared/auth/pages/ResetPasswordPage.tsx` | `src/features/auth/pages/ResetPasswordPage.tsx` |
| `shared/auth/pages/SetupRestaurantPage.tsx` | `src/features/auth/pages/SetupRestaurantPage.tsx` |
| `shared/components/Logo.tsx` | `src/components/Logo.tsx` |
| `shared/components/pos/PosComponents.tsx` | `src/features/pos/components/PosComponents.tsx` |
| `shared/components/ui/Button.tsx` | `src/components/ui/Button.tsx` |
| `shared/components/ui/ConfirmDialog.tsx` | `src/components/ui/ConfirmDialog.tsx` |
| `shared/components/ui/DataTable.tsx` | `src/components/ui/DataTable.tsx` |
| `shared/components/ui/Feedback.tsx` | `src/components/ui/Feedback.tsx` |
| `shared/components/ui/Field.tsx` | `src/components/ui/Field.tsx` |
| `shared/components/ui/Filters.tsx` | `src/components/ui/Filters.tsx` |
| `shared/components/ui/Modal.tsx` | `src/components/ui/Modal.tsx` |
| `shared/components/ui/StatusBadges.tsx` | `src/components/ui/StatusBadges.tsx` |
| `shared/components/ui/Toast.tsx` | `src/components/ui/Toast.tsx` |
| `shared/constants/settings.ts` | `src/constants/settings.ts` |
| `shared/hooks/useMediaQuery.ts` | `src/hooks/useMediaQuery.ts` |
| `shared/hooks/useQuery.ts` | `src/hooks/useQuery.ts` |
| `shared/hooks/useRealtime.ts` | `src/hooks/useRealtime.ts` |
| `shared/hooks/useStaffDirectory.ts` | `src/hooks/useStaffDirectory.ts` |
| `shared/layouts/PosShell.tsx` | `src/features/pos/layouts/PosShell.tsx` |
| `shared/pages/NotFoundPage.tsx` | `src/pages/NotFoundPage.tsx` |
| `shared/pages/ProfilePage.tsx` | `src/features/pos/pages/ProfilePage.tsx` |
| `shared/pos/cart.tsx` | `src/features/pos/context/cart.tsx` |
| `shared/pos/navItem.ts` | `src/features/pos/types/navItem.ts` |
| `shared/pos/orderData.ts` | `src/features/pos/services/orderData.ts` |
| `shared/pos/posRules.ts` | `src/features/pos/utilities/posRules.ts` |
| `shared/services/queries.ts` | `src/services/queries.ts` |
| `shared/services/storage.ts` | `src/services/storage.ts` |
| `shared/services/supabase.ts` | `src/services/supabase.ts` |
| `shared/styles/index.css` | `src/styles/index.css` |
| `shared/test/fixtures.ts` | `src/test/fixtures.ts` |
| `shared/test/mockAuth.tsx` | `src/test/mockAuth.tsx` |
| `shared/test/mockSupabase.ts` | `src/test/mockSupabase.ts` |
| `shared/test/posFixtures.ts` | `src/test/posFixtures.ts` |
| `shared/test/render.tsx` | `src/test/render.tsx` |
| `shared/test/setup.ts` | `src/test/setup.ts` |
| `shared/types/types.ts` | `src/types/types.ts` |
| `shared/utilities/__tests__/csv.test.ts` | `src/utilities/__tests__/csv.test.ts` |
| `shared/utilities/__tests__/dates.test.ts` | `src/utilities/__tests__/dates.test.ts` |
| `shared/utilities/__tests__/reports.test.ts` | `src/utilities/__tests__/reports.test.ts` |
| `shared/utilities/__tests__/schemas.test.ts` | `src/schemas/__tests__/schemas.test.ts` |
| `shared/utilities/cn.ts` | `src/utilities/cn.ts` |
| `shared/utilities/csv.ts` | `src/utilities/csv.ts` |
| `shared/utilities/dates.ts` | `src/utilities/dates.ts` |
| `shared/utilities/format.ts` | `src/utilities/format.ts` |
| `shared/utilities/reports.ts` | `src/utilities/reports.ts` |
| `shared/utilities/schemas.ts` | `src/schemas/schemas.ts` |
| `waiter/__tests__/cart.test.tsx` | `src/features/waiter/__tests__/cart.test.tsx` |
| `waiter/__tests__/pos.test.ts` | `src/features/waiter/__tests__/pos.test.ts` |
| `waiter/__tests__/waiterNavigation.test.tsx` | `src/features/waiter/__tests__/waiterNavigation.test.tsx` |
| `waiter/__tests__/waiterWorkflows.test.tsx` | `src/features/waiter/__tests__/waiterWorkflows.test.tsx` |
| `waiter/layouts/WaiterLayout.tsx` | `src/features/waiter/layouts/WaiterLayout.tsx` |
| `waiter/navigation.ts` | `src/features/waiter/navigation.ts` |
| `waiter/pages/BillsPage.tsx` | `src/features/waiter/pages/BillsPage.tsx` |
| `waiter/pages/KitchenStatusPage.tsx` | `src/features/waiter/pages/KitchenStatusPage.tsx` |
| `waiter/pages/MyOrdersPage.tsx` | `src/features/waiter/pages/MyOrdersPage.tsx` |
| `waiter/pages/NewOrderPage.tsx` | `src/features/waiter/pages/NewOrderPage.tsx` |
| `waiter/pages/NotificationsPage.tsx` | `src/features/waiter/pages/NotificationsPage.tsx` |
| `waiter/pages/WaiterDashboardPage.tsx` | `src/features/waiter/pages/WaiterDashboardPage.tsx` |
| `waiter/pages/WaiterMenuPage.tsx` | `src/features/waiter/pages/WaiterMenuPage.tsx` |
| `waiter/pages/WaiterOrderDetailPage.tsx` | `src/features/waiter/pages/WaiterOrderDetailPage.tsx` |
| `waiter/pages/WaiterTablesPage.tsx` | `src/features/waiter/pages/WaiterTablesPage.tsx` |
