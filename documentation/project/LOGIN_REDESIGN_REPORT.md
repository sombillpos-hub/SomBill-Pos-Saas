# Sign-in redesign report (22 Nov 2026)

Scope: the visual design of `/login` and `/reset-password`, plus the forgot-password code flow. The sign-in call
(`signIn` in `AuthContext`), token storage, routing and backend endpoints are unchanged.

## What changed
- **Layout:** the 44% / 56% glass card on the obsidian backdrop with drifting crimson and orange orbs, as in the brief.
  Below 960 px the flame panel is hidden and the form fills the card; below 520 px it is full-width.
- **Flame showcase:** crimson gradient with dot matrix, a 64 px squircle with 3D tilt and pulse (uses the official logo when
  `public/branding/sombill-logo.png` exists, otherwise an "S"), "SomBill POS", the headline, and three glass tiles.
- **Form:** language switch (EN | SO | AR with a sliding pill; Arabic is right-to-left, Somali and Arabic translated), Install
  App pill, logo, Welcome Back, email field with domain chips on focus, password with show/hide (spring), Caps Lock
  warning, custom "Remember me" check that draws itself, magnetic Sign In button with light sweep and a two-ring spinner.
- **Forgot password in the same card:** email -> six-box code (auto-advance, paste, backspace, shake on a wrong code, resend
  timer) -> new password -> signed in. The e-mail link keeps working and lands on `/reset-password`, now in the same design.
- **Help card, customer menu link, footer** with a live connected / offline indicator.
- Fixed while building: form labels now tie to their fields everywhere (`id` generated when none is given).

## Needs setup on Supabase
The code flow uses `verifyOtp({ type: 'recovery' })`. Supabase only puts the 6-digit code in the e-mail if the **Reset
Password** template contains `{{ .Token }}`. Add a line such as "Your code: {{ .Token }}" in Auth > Email Templates. Without it,
the e-mail has only the link, which still works. Check that the OTP length is 6 in Auth settings.

## Where the result differs from the brief, and why
| Brief | Result | Reason |
|---|---|---|
| Tab "Cashier 4-Digit PIN" | Not built | There is no PIN login in the system. A PIN pad that signs nobody in would mislead; it needs a backend design (hashed PIN per cashier, rate limits) first |
| "Passkey / Face ID" button | Not built | Supabase Auth has no passkey support here; it cannot be done in the frontend alone |
| Google button always shown | Shown only when `VITE_AUTH_GOOGLE=true` | The provider must be enabled in Supabase, otherwise the button leads to an error page |
| Install App pill always shown | Shown when the browser offers installation | The app has no web manifest yet, so most browsers offer nothing; a button that does nothing would mislead |
| Copy: "local LAN offline mesh", "Telesom & Dahabshiil settlement", "100% Offline Mesh", hotel | Copy about fast billing, audited role-based access, live HQ numbers, Zaad / EVC Plus / Somtel Money | Those features do not exist; the system needs internet and records mobile money for manual verification |
| "● All Systems Operational" | "Connected" or "You are offline", from the browser's connection | There is no status feed to report operations from |
| "Resend in 0:45" | 1:00 | Supabase allows one auth e-mail per minute per address by default; 45 s would produce errors |
| "View Customer Public Menu" | Shown only when `VITE_PUBLIC_MENU_URL` is set | No customer menu page exists yet |
| Domain chip `@company.com`, `@sombill.so` | `@gmail.com`, `@outlook.com`, `@sombill.com` | `sombill.com` is the domain used on the website |
| Support button | WhatsApp link (number and e-mail from the website's chatbot data; override with `VITE_SUPPORT_*`) | Please confirm the number |
| Dark only | Dark only | The sign-in screen is the brand front door; dashboards keep light default + dark switch |
| Language | Sign-in screens only | The rest of the app is English; full translation is a separate job |
| "Remember me" | Real: when un-ticked the login ends when the browser tab is closed | Implemented through `session.ts`; ticked keeps the Supabase default |

## Verification
TypeScript, ESLint (0 warnings), Prettier, `vite build`, Vitest 24 files / 299 tests (10 new: install pill, domain chips,
show password and Caps Lock, sign in, remember me, three languages and RTL, forgot flow with code, bad code, back and
sign-out, e-mail link page; two older tests updated for the new heading and button name). Real Chrome (`e2e/login.mjs`): sign in,
chips, code entry, Arabic at phone 390, tablet 820, laptop 1366 and desktop 1600: no overflow, targets at least 44 px,
no runtime errors.
Not verified: sending and verifying a real code on your Supabase project; Google sign-in; the official logo on the dark panel.
