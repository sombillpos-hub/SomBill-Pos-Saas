# SomBill — Public Hospitality OS Website (`frontend/apps/website/`)

Standalone, modular React + TypeScript + Vite + Tailwind CSS v4 codebase for the **public-facing SomBill Website**.

> **Scope Notice**: This package contains exclusively the public SomBill Website (landing page, 13 product modules, 7 industry solutions, pricing calculator, resources/blog/docs/FAQs, company/contact pages, interactive POS/KDS/NFC simulators, SomBill AI v2.0 chatbot assistant, and 2026 footer & modal portals). Internal operational dashboards and backend server modules are excluded.

---

## Key Features Preserved

- **2026 Floating Pill Navbar & 3-Column Glass Mega-Menu** with orbital Light/Dark theme toggle (default: **Light Mode**), 3D **EN / SO** language switcher, Log In / Live Simulator Portal, and Book Demo CTA
- **5-Device 3D Hero Ecosystem Showcase**: Interactive Desktop POS Terminal, Guest NFC Mobile Frame, Smartwatch Buzzer, Smart NFC Table Puck, and Call Bell synced via SVG data beams
- **13 Dedicated Product Module Pages** (`/product/:slug`)
- **7 Dedicated Industry Solution Pages** (`/solution/:slug`)
- **Interactive Simulators**:
  - Dual Terminal POS + Kitchen Display (KDS) Simulator (`LivePosKdsDualSimulator`)
  - Interactive NFC & QR Tap-to-Order Phone Simulator (`InteractiveNfcPhoneSimulator`)
  - Hospitality Savings & ROI Calculator (`InteractiveRoiCalculator`)
- **Transparent Pricing Page** (`/pricing`) with Annual/Monthly toggle, USD/SLSH dual-currency converter, Branch & Terminal Cost Estimator, and Industry Matrix
- **Resources Hub** (`/resources/:slug`): Hospitality Blog, Help Center, Documentation, Video Tutorials, Interactive FAQs, Case Studies, and Product Updates
- **Company & Contact Pages** (`/about`, `/why-sombill`, `/contact`, `/partners`, `/careers`, `/become-partner`)
- **SomBill AI v2.0 Bilingual Chatbot Widget** (`src/components/chatbot/`) with voice recognition & TTS readback
- **2026 Ultra-Premium Footer & Interactive CompanyModal** (`src/components/footer/`)

---

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Animations & Particles**: Framer Motion, GSAP, `@tsparticles/react`, `@tsparticles/slim`
- **Icons**: Lucide React, React Icons

---

## Folder Structure

```text
frontend/apps/website/
├── index.html · package.json · tsconfig.json · vite.config.ts · .env.example · package-lock.json
├── public/images/sombill-logo.jpeg
└── src/
    ├── main.tsx · App.tsx
    ├── assets/                   (empty for now)
    ├── components/               ui/ (premium primitives), footer/ (Footer, CompanyModal), chatbot/ (widget + styles)
    ├── sections/                 HeroEcosystemShowcase, WebsiteInteractiveSimulators
    ├── pages/                    Home/, Products/, Solutions/, Pricing/, Resources/, Company/
    ├── layouts/                  SomBillWebsite.tsx (navbar and mega-menu shell)
    ├── hooks/                    useChatBot.js
    ├── services/                 siteConfig.ts, websiteData.ts (site content), chatData.js (chatbot answers)
    ├── styles/                   globals.css (Tailwind 4 @theme)
    └── utils/                    currency.ts, routes.ts
```

---

## Architecture Guide

See [`documentation/architecture/frontend-architecture.md`](../../../documentation/architecture/frontend-architecture.md).

---

## Local Setup & Commands

```bash
# 1. Install dependencies (exact versions from package-lock.json)
npm ci

# 2. Start local development server (port 3000)
npm run dev

# 3. Type-check TypeScript
npm run lint

# Format with Prettier (shared config: ../.prettierrc.json)
npm run format
npm run format:check

# 4. Build production bundle into dist/
npm run build

# 5. Preview production build
npm run preview
```
