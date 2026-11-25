# Frontend apps + packages restructure (22 Nov 2026)

Target layout: `frontend/apps/{website, super-admin, manager, cashier, waiter}` and
`frontend/packages/{shared-ui, shared-hooks, shared-utils, shared-types, api-client, shared-config}` with a workspace
`frontend/package.json`. The request was "folders only": behaviour, routes, sign-in and role logic are unchanged.

## What was done
- 231 source files moved from `dashboards/src` and `website/src`, plus one new file (`packages/api-client/src/organization.ts`).
  The full old-to-new table is at the end of this report. Every import, `vi.mock` path and CSS `@import` was rewritten by script,
  then checked by the type-checker, ESLint, the tests and a build.
- `frontend/package.json` is now an **npm workspace** (`apps/dashboards`, `apps/manager`, `apps/cashier`, `apps/waiter`,
  `apps/super-admin`, `packages/*`). One lockfile, `frontend/package-lock.json`, taken from the old dashboards lockfile:
  **no dependency version changed** (22 workspace link entries were added). `npm ci` was verified on a clean copy.
- Imports are `@sombill/<package>/<file>` (tsconfig `paths` in `tsconfig.base.json` + Vite `resolve.alias`); packages are source-only (no build step).
- ESLint (one config at `frontend/`) now **enforces boundaries**: packages cannot import apps; an app cannot import another app or the shell.
- Empty folders from the target tree (`assets/`, and role-app folders with no files yet) hold a `.gitkeep`.
- Root `package.json`, `scripts/verify-all.sh`, `.github/workflows/frontend-ci.yml`, `.gitignore` and the living docs were updated to the new paths.

## Deviations from the requested tree (and why)
| Deviation | Reason |
| --- | --- |
| Extra folder `apps/dashboards/` (the **shell**) | The four dashboards still share one sign-in, one Supabase session and one router (`App.tsx`, `ProtectedRoute`, the `auth` feature, `/` role redirect, owner "enter branch" into Manager). Splitting those needs a sign-in/role-routing decision you postponed, so they stay in one runnable shell that mounts the four role apps. It also holds `index.html`, the Vite/Tailwind/PostCSS config, `e2e/`, `public/`. When the apps are split later it dissolves into each app. |
| Website is **not** an npm workspace member | It runs React 19, Tailwind 4, Vite 8, TypeScript 7; the dashboards run React 18, Tailwind 3, Vite 5, TypeScript 5.6. One hoisted tree would risk two React copies. It keeps its own `package.json`, lockfile and `node_modules` (unchanged lockfile). |
| Website folders mapped to the requested names | `components/sections/` to `sections/`; `config/siteConfig.ts`, `constants/websiteData.ts`, `components/chatbot/chatData.js` to `services/`; `constants/currency.ts`, `routes/routes.ts` to `utils/`; `useChatBot.js` to `hooks/`. |
| Role-app files with no matching target folder | `navigation.ts` to `layouts/navigation.ts`. Cashier `utilities/*` to `features/`. Super Admin `api/hq.ts` to `services/hq.ts`, `hooks.ts` to `hooks/hq.ts`, `context/HqContext.tsx`, `lib/*` and `types.ts` to `features/`. `__tests__/` stays inside each app's `src/`. |
| POS core (`features/pos`) split by kind | It served Waiter and Cashier, so it became shared packages: cart to `shared-hooks`, order queries to `api-client`, rules to `shared-utils`, nav item type to `shared-types`, components, `PosShell` and `ProfilePage` to `shared-ui/src/pos/`. |
| Three small code moves to remove cross-boundary imports | `createOrganization` (used by Manager > Settings > Group HQ) moved from the Super Admin service to `packages/api-client/src/organization.ts`; `sessionStore.ts` moved from `shared-hooks` to `api-client` (it holds the API token, and `api-client` must not depend on `shared-hooks`); `socket.test.tsx` moved to `shared-hooks` because it tests `useSocketEvent`. Behaviour is identical. |
| CSS split | `design-system/index.css` no longer imports `superadmin.css` and `auth.css` (a package must not import apps). `main.tsx` imports them after the design system, same order as before. |
| Test helpers | `test/*` is `packages/shared-utils/src/testing/` (renders providers, mocks Supabase). It is the only place allowed to import every package. |
| Contrast test | It reads CSS through `__dirname` instead of `process.cwd()`. |

## Verification
| Check | Result |
| --- | --- |
| `tsc -b --noEmit` (covers every app and package, 196 files) | pass |
| `eslint apps packages --max-warnings=0` (with boundary rules; two probe violations were rejected) | pass |
| `prettier --check .` | pass |
| Vitest | 24 files, 299 tests, all pass (same count as before) |
| `vite build` (dashboards) and website `tsc` + `vite build` | pass |
| `npm ci` on a clean copy (workspace and website) | pass |
| Real-Chrome checks (tablet layout, Super Admin HQ, sign-in) | all three PASSED |

Not run: the backend gates (unchanged), `docker compose` (unchanged), and no real-Supabase session.

## Old to new path of every moved file
Paths under `frontend/`. Earlier reports (`RESTRUCTURE_REPORT.md`, `FRONTEND_STACK_REPORT.md`, the design reports and the
`*_MODULES.md` path notes) keep the paths of their time; use this table to translate them.

| Old | New |
| --- | --- |
| `frontend/dashboards/src/features/cashier/__tests__/cashierLogic.test.ts` | `frontend/apps/cashier/src/__tests__/cashierLogic.test.ts` |
| `frontend/dashboards/src/features/cashier/__tests__/cashierNavigation.test.tsx` | `frontend/apps/cashier/src/__tests__/cashierNavigation.test.tsx` |
| `frontend/dashboards/src/features/cashier/__tests__/cashierShell.test.tsx` | `frontend/apps/cashier/src/__tests__/cashierShell.test.tsx` |
| `frontend/dashboards/src/features/cashier/__tests__/cashierWorkflows.test.tsx` | `frontend/apps/cashier/src/__tests__/cashierWorkflows.test.tsx` |
| `frontend/dashboards/src/features/cashier/components/BillDetail.tsx` | `frontend/apps/cashier/src/components/BillDetail.tsx` |
| `frontend/dashboards/src/features/cashier/components/CashierStatusBar.tsx` | `frontend/apps/cashier/src/components/CashierStatusBar.tsx` |
| `frontend/dashboards/src/features/cashier/components/PaymentPanel.tsx` | `frontend/apps/cashier/src/components/PaymentPanel.tsx` |
| `frontend/dashboards/src/features/cashier/components/ReceiptView.tsx` | `frontend/apps/cashier/src/components/ReceiptView.tsx` |
| `frontend/dashboards/src/features/cashier/components/ShiftPill.tsx` | `frontend/apps/cashier/src/components/ShiftPill.tsx` |
| `frontend/dashboards/src/features/cashier/utilities/payment.ts` | `frontend/apps/cashier/src/features/payment.ts` |
| `frontend/dashboards/src/features/cashier/utilities/receiptModel.ts` | `frontend/apps/cashier/src/features/receiptModel.ts` |
| `frontend/dashboards/src/features/cashier/utilities/stats.ts` | `frontend/apps/cashier/src/features/stats.ts` |
| `frontend/dashboards/src/features/cashier/hooks/useReceiptData.ts` | `frontend/apps/cashier/src/hooks/useReceiptData.ts` |
| `frontend/dashboards/src/features/cashier/hooks/useShift.ts` | `frontend/apps/cashier/src/hooks/useShift.ts` |
| `frontend/dashboards/src/features/cashier/layouts/CashierLayout.tsx` | `frontend/apps/cashier/src/layouts/CashierLayout.tsx` |
| `frontend/dashboards/src/features/cashier/navigation.ts` | `frontend/apps/cashier/src/layouts/navigation.ts` |
| `frontend/dashboards/src/features/cashier/pages/ActiveOrdersPage.tsx` | `frontend/apps/cashier/src/pages/ActiveOrdersPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/CashierBillsPage.tsx` | `frontend/apps/cashier/src/pages/CashierBillsPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/CashierDashboardPage.tsx` | `frontend/apps/cashier/src/pages/CashierDashboardPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/NewSalePage.tsx` | `frontend/apps/cashier/src/pages/NewSalePage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/PaymentProcessingPage.tsx` | `frontend/apps/cashier/src/pages/PaymentProcessingPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/PrintPage.tsx` | `frontend/apps/cashier/src/pages/PrintPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/ReceiptsPage.tsx` | `frontend/apps/cashier/src/pages/ReceiptsPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/RefundsPage.tsx` | `frontend/apps/cashier/src/pages/RefundsPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/ShiftPage.tsx` | `frontend/apps/cashier/src/pages/ShiftPage.tsx` |
| `frontend/dashboards/src/features/cashier/pages/TransactionsPage.tsx` | `frontend/apps/cashier/src/pages/TransactionsPage.tsx` |
| `frontend/dashboards/src/features/cashier/services/data.ts` | `frontend/apps/cashier/src/services/data.ts` |
| `frontend/dashboards/src/features/cashier/services/escpos.ts` | `frontend/apps/cashier/src/services/escpos.ts` |
| `frontend/dashboards/src/app/App.tsx` | `frontend/apps/dashboards/src/app/App.tsx` |
| `frontend/dashboards/src/app/main.tsx` | `frontend/apps/dashboards/src/app/main.tsx` |
| `frontend/dashboards/src/app/providers/AppProviders.tsx` | `frontend/apps/dashboards/src/app/providers/AppProviders.tsx` |
| `frontend/dashboards/src/app/router/ProtectedRoute.tsx` | `frontend/apps/dashboards/src/app/router/ProtectedRoute.tsx` |
| `frontend/dashboards/src/features/auth/__tests__/auth.test.tsx` | `frontend/apps/dashboards/src/features/auth/__tests__/auth.test.tsx` |
| `frontend/dashboards/src/features/auth/__tests__/authProvider.test.tsx` | `frontend/apps/dashboards/src/features/auth/__tests__/authProvider.test.tsx` |
| `frontend/dashboards/src/features/auth/__tests__/loginExperience.test.tsx` | `frontend/apps/dashboards/src/features/auth/__tests__/loginExperience.test.tsx` |
| `frontend/dashboards/src/features/auth/components/AuthFrame.tsx` | `frontend/apps/dashboards/src/features/auth/components/AuthFrame.tsx` |
| `frontend/dashboards/src/features/auth/components/NewPasswordForm.tsx` | `frontend/apps/dashboards/src/features/auth/components/NewPasswordForm.tsx` |
| `frontend/dashboards/src/features/auth/components/OtpInput.tsx` | `frontend/apps/dashboards/src/features/auth/components/OtpInput.tsx` |
| `frontend/dashboards/src/features/auth/components/Spinner.tsx` | `frontend/apps/dashboards/src/features/auth/components/Spinner.tsx` |
| `frontend/dashboards/src/features/auth/config.ts` | `frontend/apps/dashboards/src/features/auth/config.ts` |
| `frontend/dashboards/src/features/auth/enforceSession.ts` | `frontend/apps/dashboards/src/features/auth/enforceSession.ts` |
| `frontend/dashboards/src/features/auth/i18n.ts` | `frontend/apps/dashboards/src/features/auth/i18n.ts` |
| `frontend/dashboards/src/features/auth/pages/AccessDeniedPage.tsx` | `frontend/apps/dashboards/src/features/auth/pages/AccessDeniedPage.tsx` |
| `frontend/dashboards/src/features/auth/pages/LoginPage.tsx` | `frontend/apps/dashboards/src/features/auth/pages/LoginPage.tsx` |
| `frontend/dashboards/src/features/auth/pages/ResetPasswordPage.tsx` | `frontend/apps/dashboards/src/features/auth/pages/ResetPasswordPage.tsx` |
| `frontend/dashboards/src/features/auth/pages/SetupRestaurantPage.tsx` | `frontend/apps/dashboards/src/features/auth/pages/SetupRestaurantPage.tsx` |
| `frontend/dashboards/src/features/auth/session.ts` | `frontend/apps/dashboards/src/features/auth/session.ts` |
| `frontend/dashboards/src/features/auth/useInstallPrompt.ts` | `frontend/apps/dashboards/src/features/auth/useInstallPrompt.ts` |
| `frontend/dashboards/src/pages/NotFoundPage.tsx` | `frontend/apps/dashboards/src/pages/NotFoundPage.tsx` |
| `frontend/dashboards/src/styles/design-system/auth.css` | `frontend/apps/dashboards/src/styles/auth.css` |
| `frontend/dashboards/src/styles/index.css` | `frontend/apps/dashboards/src/styles/index.css` |
| `frontend/dashboards/src/vite-env.d.ts` | `frontend/apps/dashboards/src/vite-env.d.ts` |
| `frontend/dashboards/src/features/manager/__tests__/managerNavigation.test.tsx` | `frontend/apps/manager/src/__tests__/managerNavigation.test.tsx` |
| `frontend/dashboards/src/features/manager/__tests__/managerShell.test.tsx` | `frontend/apps/manager/src/__tests__/managerShell.test.tsx` |
| `frontend/dashboards/src/features/manager/__tests__/managerWorkflows.test.tsx` | `frontend/apps/manager/src/__tests__/managerWorkflows.test.tsx` |
| `frontend/dashboards/src/features/manager/components/AttentionBell.tsx` | `frontend/apps/manager/src/components/AttentionBell.tsx` |
| `frontend/dashboards/src/features/manager/components/BarChart.tsx` | `frontend/apps/manager/src/components/BarChart.tsx` |
| `frontend/dashboards/src/features/manager/components/ImageUpload.tsx` | `frontend/apps/manager/src/components/ImageUpload.tsx` |
| `frontend/dashboards/src/features/manager/components/ProductFormModal.tsx` | `frontend/apps/manager/src/components/ProductFormModal.tsx` |
| `frontend/dashboards/src/features/manager/components/RecipeModal.tsx` | `frontend/apps/manager/src/components/RecipeModal.tsx` |
| `frontend/dashboards/src/features/manager/layouts/AppLayout.tsx` | `frontend/apps/manager/src/layouts/AppLayout.tsx` |
| `frontend/dashboards/src/features/manager/navigation.ts` | `frontend/apps/manager/src/layouts/navigation.ts` |
| `frontend/dashboards/src/features/manager/pages/categories/CategoriesPage.tsx` | `frontend/apps/manager/src/pages/categories/CategoriesPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/customers/CustomerDetailPage.tsx` | `frontend/apps/manager/src/pages/customers/CustomerDetailPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/customers/CustomersPage.tsx` | `frontend/apps/manager/src/pages/customers/CustomersPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/dashboard/DashboardPage.tsx` | `frontend/apps/manager/src/pages/dashboard/DashboardPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/expenses/ExpensesPage.tsx` | `frontend/apps/manager/src/pages/expenses/ExpensesPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/inventory/InventoryPage.tsx` | `frontend/apps/manager/src/pages/inventory/InventoryPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/menu/ProductsPage.tsx` | `frontend/apps/manager/src/pages/menu/ProductsPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/orders/OrderDetailPage.tsx` | `frontend/apps/manager/src/pages/orders/OrderDetailPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/orders/OrdersPage.tsx` | `frontend/apps/manager/src/pages/orders/OrdersPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/purchase-orders/PurchaseOrderDetailPage.tsx` | `frontend/apps/manager/src/pages/purchase-orders/PurchaseOrderDetailPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/purchase-orders/PurchaseOrdersPage.tsx` | `frontend/apps/manager/src/pages/purchase-orders/PurchaseOrdersPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/reports/ReportsPage.tsx` | `frontend/apps/manager/src/pages/reports/ReportsPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/settings/SettingsPage.tsx` | `frontend/apps/manager/src/pages/settings/SettingsPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/staff/StaffPage.tsx` | `frontend/apps/manager/src/pages/staff/StaffPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/suppliers/SupplierDetailPage.tsx` | `frontend/apps/manager/src/pages/suppliers/SupplierDetailPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/suppliers/SuppliersPage.tsx` | `frontend/apps/manager/src/pages/suppliers/SuppliersPage.tsx` |
| `frontend/dashboards/src/features/manager/pages/tables/TablesPage.tsx` | `frontend/apps/manager/src/pages/tables/TablesPage.tsx` |
| `frontend/dashboards/src/features/superadmin/__tests__/lib.test.ts` | `frontend/apps/super-admin/src/__tests__/lib.test.ts` |
| `frontend/dashboards/src/features/superadmin/__tests__/superAdmin.test.tsx` | `frontend/apps/super-admin/src/__tests__/superAdmin.test.tsx` |
| `frontend/dashboards/src/features/superadmin/components/AuditTable.tsx` | `frontend/apps/super-admin/src/components/AuditTable.tsx` |
| `frontend/dashboards/src/features/superadmin/components/BranchCard.tsx` | `frontend/apps/super-admin/src/components/BranchCard.tsx` |
| `frontend/dashboards/src/features/superadmin/components/BranchSwitcher.tsx` | `frontend/apps/super-admin/src/components/BranchSwitcher.tsx` |
| `frontend/dashboards/src/features/superadmin/components/BroadcastModal.tsx` | `frontend/apps/super-admin/src/components/BroadcastModal.tsx` |
| `frontend/dashboards/src/features/superadmin/components/CountUp.tsx` | `frontend/apps/super-admin/src/components/CountUp.tsx` |
| `frontend/dashboards/src/features/superadmin/components/Hero.tsx` | `frontend/apps/super-admin/src/components/Hero.tsx` |
| `frontend/dashboards/src/features/superadmin/components/Kpi.tsx` | `frontend/apps/super-admin/src/components/Kpi.tsx` |
| `frontend/dashboards/src/features/superadmin/components/MenuPushForm.tsx` | `frontend/apps/super-admin/src/components/MenuPushForm.tsx` |
| `frontend/dashboards/src/features/superadmin/components/MultiBranchChart.tsx` | `frontend/apps/super-admin/src/components/MultiBranchChart.tsx` |
| `frontend/dashboards/src/features/superadmin/components/RangeTabs.tsx` | `frontend/apps/super-admin/src/components/RangeTabs.tsx` |
| `frontend/dashboards/src/features/superadmin/components/useEnterBranch.ts` | `frontend/apps/super-admin/src/components/useEnterBranch.ts` |
| `frontend/dashboards/src/features/superadmin/context/HqContext.tsx` | `frontend/apps/super-admin/src/features/HqContext.tsx` |
| `frontend/dashboards/src/features/superadmin/lib/colors.ts` | `frontend/apps/super-admin/src/features/lib/colors.ts` |
| `frontend/dashboards/src/features/superadmin/lib/mix.ts` | `frontend/apps/super-admin/src/features/lib/mix.ts` |
| `frontend/dashboards/src/features/superadmin/lib/money.ts` | `frontend/apps/super-admin/src/features/lib/money.ts` |
| `frontend/dashboards/src/features/superadmin/lib/range.ts` | `frontend/apps/super-admin/src/features/lib/range.ts` |
| `frontend/dashboards/src/features/superadmin/lib/risk.ts` | `frontend/apps/super-admin/src/features/lib/risk.ts` |
| `frontend/dashboards/src/features/superadmin/types.ts` | `frontend/apps/super-admin/src/features/types.ts` |
| `frontend/dashboards/src/features/superadmin/hooks.ts` | `frontend/apps/super-admin/src/hooks/hq.ts` |
| `frontend/dashboards/src/features/superadmin/layouts/SuperAdminLayout.tsx` | `frontend/apps/super-admin/src/layouts/SuperAdminLayout.tsx` |
| `frontend/dashboards/src/features/superadmin/navigation.ts` | `frontend/apps/super-admin/src/layouts/navigation.ts` |
| `frontend/dashboards/src/features/superadmin/pages/AuditPage.tsx` | `frontend/apps/super-admin/src/pages/AuditPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/BranchesPage.tsx` | `frontend/apps/super-admin/src/pages/BranchesPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/InventoryPage.tsx` | `frontend/apps/super-admin/src/pages/InventoryPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/LicensesPage.tsx` | `frontend/apps/super-admin/src/pages/LicensesPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/MenuPushPage.tsx` | `frontend/apps/super-admin/src/pages/MenuPushPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/MobileMoneyPage.tsx` | `frontend/apps/super-admin/src/pages/MobileMoneyPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/OverviewPage.tsx` | `frontend/apps/super-admin/src/pages/OverviewPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/RevenuePage.tsx` | `frontend/apps/super-admin/src/pages/RevenuePage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/SettingsPage.tsx` | `frontend/apps/super-admin/src/pages/SettingsPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/SystemPage.tsx` | `frontend/apps/super-admin/src/pages/SystemPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/TaxPage.tsx` | `frontend/apps/super-admin/src/pages/TaxPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/TerminalsPage.tsx` | `frontend/apps/super-admin/src/pages/TerminalsPage.tsx` |
| `frontend/dashboards/src/features/superadmin/pages/UsersPage.tsx` | `frontend/apps/super-admin/src/pages/UsersPage.tsx` |
| `frontend/dashboards/src/features/superadmin/api/hq.ts` | `frontend/apps/super-admin/src/services/hq.ts` |
| `frontend/dashboards/src/styles/design-system/superadmin.css` | `frontend/apps/super-admin/src/styles/superadmin.css` |
| `frontend/dashboards/src/features/waiter/__tests__/cart.test.tsx` | `frontend/apps/waiter/src/__tests__/cart.test.tsx` |
| `frontend/dashboards/src/features/waiter/__tests__/pos.test.ts` | `frontend/apps/waiter/src/__tests__/pos.test.ts` |
| `frontend/dashboards/src/features/waiter/__tests__/waiterNavigation.test.tsx` | `frontend/apps/waiter/src/__tests__/waiterNavigation.test.tsx` |
| `frontend/dashboards/src/features/waiter/__tests__/waiterShell.test.tsx` | `frontend/apps/waiter/src/__tests__/waiterShell.test.tsx` |
| `frontend/dashboards/src/features/waiter/__tests__/waiterWorkflows.test.tsx` | `frontend/apps/waiter/src/__tests__/waiterWorkflows.test.tsx` |
| `frontend/dashboards/src/features/waiter/layouts/WaiterLayout.tsx` | `frontend/apps/waiter/src/layouts/WaiterLayout.tsx` |
| `frontend/dashboards/src/features/waiter/navigation.ts` | `frontend/apps/waiter/src/layouts/navigation.ts` |
| `frontend/dashboards/src/features/waiter/pages/BillsPage.tsx` | `frontend/apps/waiter/src/pages/BillsPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/KitchenStatusPage.tsx` | `frontend/apps/waiter/src/pages/KitchenStatusPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/MyOrdersPage.tsx` | `frontend/apps/waiter/src/pages/MyOrdersPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/NewOrderPage.tsx` | `frontend/apps/waiter/src/pages/NewOrderPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/NotificationsPage.tsx` | `frontend/apps/waiter/src/pages/NotificationsPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/WaiterDashboardPage.tsx` | `frontend/apps/waiter/src/pages/WaiterDashboardPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/WaiterMenuPage.tsx` | `frontend/apps/waiter/src/pages/WaiterMenuPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/WaiterOrderDetailPage.tsx` | `frontend/apps/waiter/src/pages/WaiterOrderDetailPage.tsx` |
| `frontend/dashboards/src/features/waiter/pages/WaiterTablesPage.tsx` | `frontend/apps/waiter/src/pages/WaiterTablesPage.tsx` |
| `frontend/website/src/App.tsx` | `frontend/apps/website/src/App.tsx` |
| `frontend/website/src/components/chatbot/ChatBotWidget.css` | `frontend/apps/website/src/components/chatbot/ChatBotWidget.css` |
| `frontend/website/src/components/chatbot/ChatBotWidget.jsx` | `frontend/apps/website/src/components/chatbot/ChatBotWidget.jsx` |
| `frontend/website/src/components/footer/CompanyModal.css` | `frontend/apps/website/src/components/footer/CompanyModal.css` |
| `frontend/website/src/components/footer/CompanyModal.jsx` | `frontend/apps/website/src/components/footer/CompanyModal.jsx` |
| `frontend/website/src/components/footer/Footer.css` | `frontend/apps/website/src/components/footer/Footer.css` |
| `frontend/website/src/components/footer/Footer.jsx` | `frontend/apps/website/src/components/footer/Footer.jsx` |
| `frontend/website/src/components/ui/PremiumPrimitives.tsx` | `frontend/apps/website/src/components/ui/PremiumPrimitives.tsx` |
| `frontend/website/src/components/chatbot/useChatBot.js` | `frontend/apps/website/src/hooks/useChatBot.js` |
| `frontend/website/src/layouts/SomBillWebsite.tsx` | `frontend/apps/website/src/layouts/SomBillWebsite.tsx` |
| `frontend/website/src/main.tsx` | `frontend/apps/website/src/main.tsx` |
| `frontend/website/src/pages/Company/CompanyDetailPage.tsx` | `frontend/apps/website/src/pages/Company/CompanyDetailPage.tsx` |
| `frontend/website/src/pages/Home/HomePage.tsx` | `frontend/apps/website/src/pages/Home/HomePage.tsx` |
| `frontend/website/src/pages/Pricing/PricingPage.tsx` | `frontend/apps/website/src/pages/Pricing/PricingPage.tsx` |
| `frontend/website/src/pages/Products/ProductDetailPage.tsx` | `frontend/apps/website/src/pages/Products/ProductDetailPage.tsx` |
| `frontend/website/src/pages/Resources/ResourceDetailPage.tsx` | `frontend/apps/website/src/pages/Resources/ResourceDetailPage.tsx` |
| `frontend/website/src/pages/Solutions/SolutionDetailPage.tsx` | `frontend/apps/website/src/pages/Solutions/SolutionDetailPage.tsx` |
| `frontend/website/src/components/sections/HeroEcosystemShowcase.tsx` | `frontend/apps/website/src/sections/HeroEcosystemShowcase.tsx` |
| `frontend/website/src/components/sections/WebsiteInteractiveSimulators.tsx` | `frontend/apps/website/src/sections/WebsiteInteractiveSimulators.tsx` |
| `frontend/website/src/components/chatbot/chatData.js` | `frontend/apps/website/src/services/chatData.js` |
| `frontend/website/src/config/siteConfig.ts` | `frontend/apps/website/src/services/siteConfig.ts` |
| `frontend/website/src/constants/websiteData.ts` | `frontend/apps/website/src/services/websiteData.ts` |
| `frontend/website/src/styles/globals.css` | `frontend/apps/website/src/styles/globals.css` |
| `frontend/website/src/constants/currency.ts` | `frontend/apps/website/src/utils/currency.ts` |
| `frontend/website/src/routes/routes.ts` | `frontend/apps/website/src/utils/routes.ts` |
| `frontend/dashboards/src/api/__tests__/httpClient.test.ts` | `frontend/packages/api-client/src/__tests__/httpClient.test.ts` |
| `frontend/dashboards/src/api/httpClient.ts` | `frontend/packages/api-client/src/httpClient.ts` |
| `frontend/dashboards/src/features/pos/services/orderData.ts` | `frontend/packages/api-client/src/orderData.ts` |
| `frontend/dashboards/src/services/queries.ts` | `frontend/packages/api-client/src/queries.ts` |
| `frontend/dashboards/src/api/queryClient.ts` | `frontend/packages/api-client/src/queryClient.ts` |
| `frontend/dashboards/src/stores/sessionStore.ts` | `frontend/packages/api-client/src/sessionStore.ts` |
| `frontend/dashboards/src/api/socket.ts` | `frontend/packages/api-client/src/socket.ts` |
| `frontend/dashboards/src/services/storage.ts` | `frontend/packages/api-client/src/storage.ts` |
| `frontend/dashboards/src/services/supabase.ts` | `frontend/packages/api-client/src/supabase.ts` |
| `frontend/dashboards/src/config/env.ts` | `frontend/packages/shared-config/src/env.ts` |
| `frontend/dashboards/src/constants/settings.ts` | `frontend/packages/shared-config/src/settings.ts` |
| `frontend/dashboards/src/contexts/AuthContext.tsx` | `frontend/packages/shared-hooks/src/AuthContext.tsx` |
| `frontend/dashboards/src/api/__tests__/socket.test.tsx` | `frontend/packages/shared-hooks/src/__tests__/socket.test.tsx` |
| `frontend/dashboards/src/features/pos/context/cart.tsx` | `frontend/packages/shared-hooks/src/cart.tsx` |
| `frontend/dashboards/src/hooks/useMediaQuery.ts` | `frontend/packages/shared-hooks/src/useMediaQuery.ts` |
| `frontend/dashboards/src/hooks/useQuery.ts` | `frontend/packages/shared-hooks/src/useQuery.ts` |
| `frontend/dashboards/src/hooks/useRealtime.ts` | `frontend/packages/shared-hooks/src/useRealtime.ts` |
| `frontend/dashboards/src/hooks/useSbTheme.ts` | `frontend/packages/shared-hooks/src/useSbTheme.ts` |
| `frontend/dashboards/src/hooks/useSocketEvent.ts` | `frontend/packages/shared-hooks/src/useSocketEvent.ts` |
| `frontend/dashboards/src/hooks/useStaffDirectory.ts` | `frontend/packages/shared-hooks/src/useStaffDirectory.ts` |
| `frontend/dashboards/src/schemas/__tests__/schemas.test.ts` | `frontend/packages/shared-types/src/__tests__/schemas.test.ts` |
| `frontend/dashboards/src/features/pos/types/navItem.ts` | `frontend/packages/shared-types/src/navItem.ts` |
| `frontend/dashboards/src/schemas/schemas.ts` | `frontend/packages/shared-types/src/schemas.ts` |
| `frontend/dashboards/src/types/types.ts` | `frontend/packages/shared-types/src/types.ts` |
| `frontend/dashboards/src/components/Logo.tsx` | `frontend/packages/shared-ui/src/Logo.tsx` |
| `frontend/dashboards/src/components/motion/Motion.tsx` | `frontend/packages/shared-ui/src/motion/Motion.tsx` |
| `frontend/dashboards/src/features/pos/components/PosComponents.tsx` | `frontend/packages/shared-ui/src/pos/PosComponents.tsx` |
| `frontend/dashboards/src/features/pos/layouts/PosShell.tsx` | `frontend/packages/shared-ui/src/pos/PosShell.tsx` |
| `frontend/dashboards/src/features/pos/pages/ProfilePage.tsx` | `frontend/packages/shared-ui/src/pos/ProfilePage.tsx` |
| `frontend/dashboards/src/components/shell/BrandMark.tsx` | `frontend/packages/shared-ui/src/shell/BrandMark.tsx` |
| `frontend/dashboards/src/components/shell/CommandPalette.tsx` | `frontend/packages/shared-ui/src/shell/CommandPalette.tsx` |
| `frontend/dashboards/src/components/shell/ConnectionBadge.tsx` | `frontend/packages/shared-ui/src/shell/ConnectionBadge.tsx` |
| `frontend/dashboards/src/components/shell/OfflineBanner.tsx` | `frontend/packages/shared-ui/src/shell/OfflineBanner.tsx` |
| `frontend/dashboards/src/components/shell/PosDock.tsx` | `frontend/packages/shared-ui/src/shell/PosDock.tsx` |
| `frontend/dashboards/src/components/shell/PosStatusBar.tsx` | `frontend/packages/shared-ui/src/shell/PosStatusBar.tsx` |
| `frontend/dashboards/src/components/shell/PosTopbar.tsx` | `frontend/packages/shared-ui/src/shell/PosTopbar.tsx` |
| `frontend/dashboards/src/components/shell/ShellClock.tsx` | `frontend/packages/shared-ui/src/shell/ShellClock.tsx` |
| `frontend/dashboards/src/components/shell/ShellFooter.tsx` | `frontend/packages/shared-ui/src/shell/ShellFooter.tsx` |
| `frontend/dashboards/src/components/shell/ShellSidebar.tsx` | `frontend/packages/shared-ui/src/shell/ShellSidebar.tsx` |
| `frontend/dashboards/src/components/shell/ShellTopbar.tsx` | `frontend/packages/shared-ui/src/shell/ShellTopbar.tsx` |
| `frontend/dashboards/src/components/shell/ThemeToggle.tsx` | `frontend/packages/shared-ui/src/shell/ThemeToggle.tsx` |
| `frontend/dashboards/src/styles/design-system/__tests__/contrast.test.ts` | `frontend/packages/shared-ui/src/styles/design-system/__tests__/contrast.test.ts` |
| `frontend/dashboards/src/styles/design-system/index.css` | `frontend/packages/shared-ui/src/styles/design-system/index.css` |
| `frontend/dashboards/src/styles/design-system/light.css` | `frontend/packages/shared-ui/src/styles/design-system/light.css` |
| `frontend/dashboards/src/styles/design-system/motion.css` | `frontend/packages/shared-ui/src/styles/design-system/motion.css` |
| `frontend/dashboards/src/styles/design-system/obsidian.css` | `frontend/packages/shared-ui/src/styles/design-system/obsidian.css` |
| `frontend/dashboards/src/styles/design-system/pos.css` | `frontend/packages/shared-ui/src/styles/design-system/pos.css` |
| `frontend/dashboards/src/styles/design-system/shell.css` | `frontend/packages/shared-ui/src/styles/design-system/shell.css` |
| `frontend/dashboards/src/styles/design-system/tokens.css` | `frontend/packages/shared-ui/src/styles/design-system/tokens.css` |
| `frontend/dashboards/src/components/ui/Button.tsx` | `frontend/packages/shared-ui/src/ui/Button.tsx` |
| `frontend/dashboards/src/components/ui/ConfirmDialog.tsx` | `frontend/packages/shared-ui/src/ui/ConfirmDialog.tsx` |
| `frontend/dashboards/src/components/ui/DataTable.tsx` | `frontend/packages/shared-ui/src/ui/DataTable.tsx` |
| `frontend/dashboards/src/components/ui/Feedback.tsx` | `frontend/packages/shared-ui/src/ui/Feedback.tsx` |
| `frontend/dashboards/src/components/ui/Field.tsx` | `frontend/packages/shared-ui/src/ui/Field.tsx` |
| `frontend/dashboards/src/components/ui/Filters.tsx` | `frontend/packages/shared-ui/src/ui/Filters.tsx` |
| `frontend/dashboards/src/components/ui/Modal.tsx` | `frontend/packages/shared-ui/src/ui/Modal.tsx` |
| `frontend/dashboards/src/components/ui/StatusBadges.tsx` | `frontend/packages/shared-ui/src/ui/StatusBadges.tsx` |
| `frontend/dashboards/src/components/ui/Toast.tsx` | `frontend/packages/shared-ui/src/ui/Toast.tsx` |
| `frontend/dashboards/src/utilities/__tests__/csv.test.ts` | `frontend/packages/shared-utils/src/__tests__/csv.test.ts` |
| `frontend/dashboards/src/utilities/__tests__/dates.test.ts` | `frontend/packages/shared-utils/src/__tests__/dates.test.ts` |
| `frontend/dashboards/src/utilities/__tests__/reports.test.ts` | `frontend/packages/shared-utils/src/__tests__/reports.test.ts` |
| `frontend/dashboards/src/utilities/cn.ts` | `frontend/packages/shared-utils/src/cn.ts` |
| `frontend/dashboards/src/utilities/csv.ts` | `frontend/packages/shared-utils/src/csv.ts` |
| `frontend/dashboards/src/utilities/dates.ts` | `frontend/packages/shared-utils/src/dates.ts` |
| `frontend/dashboards/src/utilities/format.ts` | `frontend/packages/shared-utils/src/format.ts` |
| `frontend/dashboards/src/features/pos/utilities/posRules.ts` | `frontend/packages/shared-utils/src/posRules.ts` |
| `frontend/dashboards/src/utilities/reports.ts` | `frontend/packages/shared-utils/src/reports.ts` |
| `frontend/dashboards/src/test/fixtures.ts` | `frontend/packages/shared-utils/src/testing/fixtures.ts` |
| `frontend/dashboards/src/test/mockAuth.tsx` | `frontend/packages/shared-utils/src/testing/mockAuth.tsx` |
| `frontend/dashboards/src/test/mockSupabase.ts` | `frontend/packages/shared-utils/src/testing/mockSupabase.ts` |
| `frontend/dashboards/src/test/posFixtures.ts` | `frontend/packages/shared-utils/src/testing/posFixtures.ts` |
| `frontend/dashboards/src/test/render.tsx` | `frontend/packages/shared-utils/src/testing/render.tsx` |
| `frontend/dashboards/src/test/setup.ts` | `frontend/packages/shared-utils/src/testing/setup.ts` |
