# RESTRUCTURE_REPORT — SomBill-Dashboards

_22 Nov 2026. Generated from the move mapping that was actually applied._

## What changed

- **161 files** in total. **128 moved** into `manager/`, `waiter/`, `cashier/`, `shared/`, `routing/` and `documentation/`. **33 unchanged in place**: the project configuration, `supabase/` and `e2e/`.
- **830 import specifiers** rewritten automatically. Each import was resolved against the old tree and re-pointed at the file's new location.
- **1 new file:** `shared/pos/navItem.ts`. It holds the sidebar item type both POS apps use, previously declared in `waiter/navigation.ts`. The Cashier POS imported it from the Waiter folder; it now comes from `shared/`. `waiter/navigation.ts` keeps `WaiterNavItem` as an alias of the same type.
- **No file deleted, no behaviour changed.** Aside from import lines, the only source edits are that type move and one code comment (the logo path in `Logo.tsx`).
- The original project was left untouched. The restructure was built as a copy and verified before delivery.

## Why the shared files are shared

An import trace found that the Cashier POS used several files from the Waiter folder: the cart, POS rules (totals, permissions), order queries, the profile page, the nav item type and the test fixtures. These are POS-wide, not waiter-only, so they moved to `shared/`. Everything used by more than one dashboard (UI kit, hooks, services, utilities, auth, types, styles) is in `shared/`. Files used by a single dashboard live in that dashboard: for example `BarChart` and `ImageUpload` (Manager only), and `escpos`, `PaymentPanel` and `useShift` (Cashier only).

## Renamed while moving

| Old | New | Reason |
|---|---|---|
| `src/__tests__/navigation.test.tsx` | `manager/__tests__/managerNavigation.test.tsx` | distinguishes it from the Waiter/Cashier navigation tests |
| `src/__tests__/workflows.test.tsx` | `manager/__tests__/managerWorkflows.test.tsx` | distinguishes it from the Waiter/Cashier workflow tests |
| `src/cashier/receipt/model.ts` | `cashier/utilities/receiptModel.ts` | flattened from receipt/ into utilities/ |
| `src/pos/components.tsx` | `shared/components/pos/PosComponents.tsx` | clearer name in shared/components/pos |
| `src/waiter/pos.ts` | `shared/pos/posRules.ts` | describes what it holds (POS rules) |
| `src/waiter/data.ts` | `shared/pos/orderData.ts` | describes what it holds (order queries) |
| `src/waiter/__tests__/waiterFixtures.ts` | `shared/test/posFixtures.ts` | used by both POS test suites |

## Every file moved

### routing/ (4 files)

| From | To |
|---|---|
| `src/App.tsx` | `routing/App.tsx` |
| `src/components/layout/ProtectedRoute.tsx` | `routing/ProtectedRoute.tsx` |
| `src/main.tsx` | `routing/main.tsx` |
| `src/vite-env.d.ts` | `routing/vite-env.d.ts` |

### manager/ (26 files)

| From | To |
|---|---|
| `src/__tests__/manageStaff.test.ts` | `manager/__tests__/manageStaff.test.ts` |
| `src/__tests__/navigation.test.tsx` | `manager/__tests__/managerNavigation.test.tsx` |
| `src/__tests__/workflows.test.tsx` | `manager/__tests__/managerWorkflows.test.tsx` |
| `src/components/charts/BarChart.tsx` | `manager/components/BarChart.tsx` |
| `src/components/ui/ImageUpload.tsx` | `manager/components/ImageUpload.tsx` |
| `src/pages/menu/ProductFormModal.tsx` | `manager/components/ProductFormModal.tsx` |
| `src/pages/menu/RecipeModal.tsx` | `manager/components/RecipeModal.tsx` |
| `src/components/layout/AppLayout.tsx` | `manager/layouts/AppLayout.tsx` |
| `src/components/layout/navigation.ts` | `manager/navigation.ts` |
| `src/pages/categories/CategoriesPage.tsx` | `manager/pages/categories/CategoriesPage.tsx` |
| `src/pages/customers/CustomerDetailPage.tsx` | `manager/pages/customers/CustomerDetailPage.tsx` |
| `src/pages/customers/CustomersPage.tsx` | `manager/pages/customers/CustomersPage.tsx` |
| `src/pages/dashboard/DashboardPage.tsx` | `manager/pages/dashboard/DashboardPage.tsx` |
| `src/pages/expenses/ExpensesPage.tsx` | `manager/pages/expenses/ExpensesPage.tsx` |
| `src/pages/inventory/InventoryPage.tsx` | `manager/pages/inventory/InventoryPage.tsx` |
| `src/pages/menu/ProductsPage.tsx` | `manager/pages/menu/ProductsPage.tsx` |
| `src/pages/orders/OrderDetailPage.tsx` | `manager/pages/orders/OrderDetailPage.tsx` |
| `src/pages/orders/OrdersPage.tsx` | `manager/pages/orders/OrdersPage.tsx` |
| `src/pages/purchase-orders/PurchaseOrderDetailPage.tsx` | `manager/pages/purchase-orders/PurchaseOrderDetailPage.tsx` |
| `src/pages/purchase-orders/PurchaseOrdersPage.tsx` | `manager/pages/purchase-orders/PurchaseOrdersPage.tsx` |
| `src/pages/reports/ReportsPage.tsx` | `manager/pages/reports/ReportsPage.tsx` |
| `src/pages/settings/SettingsPage.tsx` | `manager/pages/settings/SettingsPage.tsx` |
| `src/pages/staff/StaffPage.tsx` | `manager/pages/staff/StaffPage.tsx` |
| `src/pages/suppliers/SupplierDetailPage.tsx` | `manager/pages/suppliers/SupplierDetailPage.tsx` |
| `src/pages/suppliers/SuppliersPage.tsx` | `manager/pages/suppliers/SuppliersPage.tsx` |
| `src/pages/tables/TablesPage.tsx` | `manager/pages/tables/TablesPage.tsx` |

### waiter/ (15 files)

| From | To |
|---|---|
| `src/waiter/__tests__/cart.test.tsx` | `waiter/__tests__/cart.test.tsx` |
| `src/waiter/__tests__/pos.test.ts` | `waiter/__tests__/pos.test.ts` |
| `src/waiter/__tests__/waiterNavigation.test.tsx` | `waiter/__tests__/waiterNavigation.test.tsx` |
| `src/waiter/__tests__/waiterWorkflows.test.tsx` | `waiter/__tests__/waiterWorkflows.test.tsx` |
| `src/waiter/WaiterLayout.tsx` | `waiter/layouts/WaiterLayout.tsx` |
| `src/waiter/navigation.ts` | `waiter/navigation.ts` |
| `src/waiter/pages/BillsPage.tsx` | `waiter/pages/BillsPage.tsx` |
| `src/waiter/pages/KitchenStatusPage.tsx` | `waiter/pages/KitchenStatusPage.tsx` |
| `src/waiter/pages/MyOrdersPage.tsx` | `waiter/pages/MyOrdersPage.tsx` |
| `src/waiter/pages/NewOrderPage.tsx` | `waiter/pages/NewOrderPage.tsx` |
| `src/waiter/pages/NotificationsPage.tsx` | `waiter/pages/NotificationsPage.tsx` |
| `src/waiter/pages/WaiterDashboardPage.tsx` | `waiter/pages/WaiterDashboardPage.tsx` |
| `src/waiter/pages/WaiterMenuPage.tsx` | `waiter/pages/WaiterMenuPage.tsx` |
| `src/waiter/pages/WaiterOrderDetailPage.tsx` | `waiter/pages/WaiterOrderDetailPage.tsx` |
| `src/waiter/pages/WaiterTablesPage.tsx` | `waiter/pages/WaiterTablesPage.tsx` |

### cashier/ (25 files)

| From | To |
|---|---|
| `src/cashier/__tests__/cashierLogic.test.ts` | `cashier/__tests__/cashierLogic.test.ts` |
| `src/cashier/__tests__/cashierNavigation.test.tsx` | `cashier/__tests__/cashierNavigation.test.tsx` |
| `src/cashier/__tests__/cashierWorkflows.test.tsx` | `cashier/__tests__/cashierWorkflows.test.tsx` |
| `src/cashier/BillDetail.tsx` | `cashier/components/BillDetail.tsx` |
| `src/cashier/PaymentPanel.tsx` | `cashier/components/PaymentPanel.tsx` |
| `src/cashier/receipt/ReceiptView.tsx` | `cashier/components/ReceiptView.tsx` |
| `src/cashier/receipt/useReceiptData.ts` | `cashier/hooks/useReceiptData.ts` |
| `src/cashier/useShift.ts` | `cashier/hooks/useShift.ts` |
| `src/cashier/CashierLayout.tsx` | `cashier/layouts/CashierLayout.tsx` |
| `src/cashier/navigation.ts` | `cashier/navigation.ts` |
| `src/cashier/pages/ActiveOrdersPage.tsx` | `cashier/pages/ActiveOrdersPage.tsx` |
| `src/cashier/pages/CashierBillsPage.tsx` | `cashier/pages/CashierBillsPage.tsx` |
| `src/cashier/pages/CashierDashboardPage.tsx` | `cashier/pages/CashierDashboardPage.tsx` |
| `src/cashier/pages/NewSalePage.tsx` | `cashier/pages/NewSalePage.tsx` |
| `src/cashier/pages/PaymentProcessingPage.tsx` | `cashier/pages/PaymentProcessingPage.tsx` |
| `src/cashier/pages/PrintPage.tsx` | `cashier/pages/PrintPage.tsx` |
| `src/cashier/pages/ReceiptsPage.tsx` | `cashier/pages/ReceiptsPage.tsx` |
| `src/cashier/pages/RefundsPage.tsx` | `cashier/pages/RefundsPage.tsx` |
| `src/cashier/pages/ShiftPage.tsx` | `cashier/pages/ShiftPage.tsx` |
| `src/cashier/pages/TransactionsPage.tsx` | `cashier/pages/TransactionsPage.tsx` |
| `src/cashier/data.ts` | `cashier/services/data.ts` |
| `src/cashier/receipt/escpos.ts` | `cashier/services/escpos.ts` |
| `src/cashier/payment.ts` | `cashier/utilities/payment.ts` |
| `src/cashier/receipt/model.ts` | `cashier/utilities/receiptModel.ts` |
| `src/cashier/stats.ts` | `cashier/utilities/stats.ts` |

### shared/ (51 files)

| From | To |
|---|---|
| `public/branding/README.md` | `shared/assets/branding/README.md` |
| `src/context/AuthContext.tsx` | `shared/auth/AuthContext.tsx` |
| `src/__tests__/auth.test.tsx` | `shared/auth/__tests__/auth.test.tsx` |
| `src/__tests__/authProvider.test.tsx` | `shared/auth/__tests__/authProvider.test.tsx` |
| `src/pages/auth/AccessDeniedPage.tsx` | `shared/auth/pages/AccessDeniedPage.tsx` |
| `src/pages/auth/LoginPage.tsx` | `shared/auth/pages/LoginPage.tsx` |
| `src/pages/auth/ResetPasswordPage.tsx` | `shared/auth/pages/ResetPasswordPage.tsx` |
| `src/pages/auth/SetupRestaurantPage.tsx` | `shared/auth/pages/SetupRestaurantPage.tsx` |
| `src/components/layout/Logo.tsx` | `shared/components/Logo.tsx` |
| `src/pos/components.tsx` | `shared/components/pos/PosComponents.tsx` |
| `src/components/ui/Button.tsx` | `shared/components/ui/Button.tsx` |
| `src/components/ui/ConfirmDialog.tsx` | `shared/components/ui/ConfirmDialog.tsx` |
| `src/components/ui/DataTable.tsx` | `shared/components/ui/DataTable.tsx` |
| `src/components/ui/Feedback.tsx` | `shared/components/ui/Feedback.tsx` |
| `src/components/ui/Field.tsx` | `shared/components/ui/Field.tsx` |
| `src/components/ui/Filters.tsx` | `shared/components/ui/Filters.tsx` |
| `src/components/ui/Modal.tsx` | `shared/components/ui/Modal.tsx` |
| `src/components/ui/StatusBadges.tsx` | `shared/components/ui/StatusBadges.tsx` |
| `src/components/ui/Toast.tsx` | `shared/components/ui/Toast.tsx` |
| `src/lib/settings.ts` | `shared/constants/settings.ts` |
| `src/hooks/useMediaQuery.ts` | `shared/hooks/useMediaQuery.ts` |
| `src/hooks/useQuery.ts` | `shared/hooks/useQuery.ts` |
| `src/hooks/useRealtime.ts` | `shared/hooks/useRealtime.ts` |
| `src/hooks/useStaffDirectory.ts` | `shared/hooks/useStaffDirectory.ts` |
| `src/pos/PosShell.tsx` | `shared/layouts/PosShell.tsx` |
| `src/pages/NotFoundPage.tsx` | `shared/pages/NotFoundPage.tsx` |
| `src/waiter/pages/ProfilePage.tsx` | `shared/pages/ProfilePage.tsx` |
| `src/waiter/cart.tsx` | `shared/pos/cart.tsx` |
| `src/waiter/data.ts` | `shared/pos/orderData.ts` |
| `src/waiter/pos.ts` | `shared/pos/posRules.ts` |
| `src/lib/queries.ts` | `shared/services/queries.ts` |
| `src/lib/storage.ts` | `shared/services/storage.ts` |
| `src/lib/supabase.ts` | `shared/services/supabase.ts` |
| `src/index.css` | `shared/styles/index.css` |
| `src/test/fixtures.ts` | `shared/test/fixtures.ts` |
| `src/test/mockAuth.tsx` | `shared/test/mockAuth.tsx` |
| `src/test/mockSupabase.ts` | `shared/test/mockSupabase.ts` |
| `src/waiter/__tests__/waiterFixtures.ts` | `shared/test/posFixtures.ts` |
| `src/test/render.tsx` | `shared/test/render.tsx` |
| `src/test/setup.ts` | `shared/test/setup.ts` |
| `src/lib/types.ts` | `shared/types/types.ts` |
| `src/lib/__tests__/csv.test.ts` | `shared/utilities/__tests__/csv.test.ts` |
| `src/lib/__tests__/dates.test.ts` | `shared/utilities/__tests__/dates.test.ts` |
| `src/lib/__tests__/reports.test.ts` | `shared/utilities/__tests__/reports.test.ts` |
| `src/lib/__tests__/schemas.test.ts` | `shared/utilities/__tests__/schemas.test.ts` |
| `src/lib/cn.ts` | `shared/utilities/cn.ts` |
| `src/lib/csv.ts` | `shared/utilities/csv.ts` |
| `src/lib/dates.ts` | `shared/utilities/dates.ts` |
| `src/lib/format.ts` | `shared/utilities/format.ts` |
| `src/lib/reports.ts` | `shared/utilities/reports.ts` |
| `src/lib/schemas.ts` | `shared/utilities/schemas.ts` |

### documentation/ (7 files)

| From | To |
|---|---|
| `CASHIER_MODULES.md` | `documentation/CASHIER_MODULES.md` |
| `CASHIER_TEST_REPORT.md` | `documentation/CASHIER_TEST_REPORT.md` |
| `MANAGER_MODULES.md` | `documentation/MANAGER_MODULES.md` |
| `MANAGER_TEST_REPORT.md` | `documentation/MANAGER_TEST_REPORT.md` |
| `PROJECT_STATUS.md` | `documentation/PROJECT_STATUS.md` |
| `WAITER_MODULES.md` | `documentation/WAITER_MODULES.md` |
| `WAITER_TEST_REPORT.md` | `documentation/WAITER_TEST_REPORT.md` |

## Configuration changes

| File | Change |
|---|---|
| `vite.config.ts` | `@` alias `./src` → `./` (project root). `publicDir: 'shared/assets'`. Vitest `setupFiles` → `./shared/test/setup.ts`, `include` → `{manager,waiter,cashier,shared,routing}/**/*.test.{ts,tsx}` |
| `tsconfig.app.json` | `paths` `@/*` → `./*`. `include` → `manager, waiter, cashier, shared, routing` |
| `tailwind.config.js` | `content` → `./index.html` + `./{manager,waiter,cashier,shared,routing}/**/*.{ts,tsx}` |
| `index.html` | entry script `/src/main.tsx` → `/routing/main.tsx`. Title `SomBill`, and the description now names all three dashboards |
| `eslint.config.js` | `dist-e2e` added to ignores |
| `package.json / package-lock.json` | package name `sombill-manager` → `sombill-dashboards`, plus the description. Dependencies and scripts unchanged |
| `public/` | moved to `shared/assets/`. Files are still served at the same URLs (`/branding/sombill-logo.png`) |

## Verification after the restructure

| Check | Result |
|---|---|
| TypeScript strict (`tsc -b`) | ✅ 0 errors |
| ESLint (`--max-warnings=0`) | ✅ 0 problems |
| Vitest, 3 consecutive runs | ✅ 16 files, 198 / 198 tests each run (same totals as before) |
| Production build | ✅ |
| Built CSS vs. original build | ✅ identical: 39,515 bytes, same 521 selectors (Tailwind finds every class in the new folders) |
| Real Chrome: 19 dashboard pages × 3 viewports | ✅ 57 / 57 |
| Real Chrome: 80mm receipt and bill PDFs | ✅ 80.09 mm wide, 1 page each |
| Database tests (PostgreSQL 16) | ✅ 303 assertions + concurrency tests |
| Cross-dashboard imports | ✅ none. `shared/` imports nothing dashboard-specific |
| Unresolved imports | ✅ none (every specifier resolved during the move) |
