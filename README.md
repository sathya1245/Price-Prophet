<div align="center">

# 🔮 PriceProphet

**AI-inspired dynamic pricing. Smarter prices. Bigger margins.**

[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://sathya1245.github.io/Price-Prophet/)
[![Made with React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Powered by Vite](https://img.shields.io/badge/Vite-5-purple.svg)](https://vitejs.dev/)
[![Personal Project](https://img.shields.io/badge/project-personal-orange.svg)]()

[Live Demo](https://sathya1245.github.io/Price-Prophet/) · [Features](#-features) · [How It Works](#-how-it-works) · [Getting Started](#-getting-started) · [Roadmap](#-roadmap)

---

</div>

## 🌐 Live Demo

**https://sathya1245.github.io/Price-Prophet/**

The demo runs entirely in your browser — no sign-up, no API key, no backend. Open the link, click **Launch Platform**, and enter any product to get a full pricing report (recommended price, price band, competitor intelligence, seasonality, conversion curve, market evidence, CSV/PDF export).

---

## 🧠 What is PriceProphet?

**PriceProphet** is a personal dynamic pricing platform that helps businesses find the *perfect* selling price — every time. By combining competitor intelligence, market trend analysis, location-aware demand signals, and forecasting models, PriceProphet removes the guesswork from pricing strategy.

Whether you're a retailer, marketplace, or e-commerce brand, PriceProphet adapts prices to maximize revenue, stay competitive, and respond to market shifts.

> *"Stop leaving money on the table. Let the data decide."*

---

## ✨ Features

### 🕵️ Competitor Intelligence
- Estimated competitor prices, stock status, and 6-month price history
- Price band spread across the tracked competitor set
- Category-aware competitor benchmarking

### 📈 Market Trend Analysis
- Seasonal demand signals with an explicit adjustment factor
- Month-by-month retail pattern modelling (holiday peak, summer window, lulls)
- Festival-aware uplift for Indian markets (Diwali / festive season)

### 📍 Location-Aware Pricing
- Location price index for 20+ major markets (US, UK, EU, Gulf, India, APAC)
- Regional benchmark pricing rather than a single global default
- Local price index shown in the evidence panel

### 🔮 Smart Forecasting
- Gross-margin floor so a recommendation never breaches cost + 10%
- Revenue vs. price conversion curve with a negative-elasticity demand model
- Confidence score that reflects how complete your input is

### ⚡ Dynamic Price Engine
- Pricing strategy selection (Cost-Plus / Competitor-Based / Value-Based)
- Scenario modeler for shipping shocks, competitor drops and demand swings
- Rule engine with trigger-based actions and per-rule on/off toggles

### 📊 Dashboard & Reporting
- Unified pricing dashboard with recommended / floor / premium price bands
- Print-ready PDF export and CSV export
- Customizable platform name and logo

---

## 🔧 How It Works

```
┌──────────────────────────────────────────────────────────┐
│                      PriceProphet                        │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Data Layer │ → │  Price Model │ → │ Price Output │  │
│  └─────────────┘   └──────────────┘   └──────────────┘  │
│                                                          │
│  Inputs:            Models:              Actions:        │
│  • Cost             • Margin floor        • Dashboard UI │
│  • Category         • Location index      • CSV export   │
│  • Location         • Seasonality         • PDF export   │
│  • Target margin    • Elasticity curve    • Scenario sim │
└──────────────────────────────────────────────────────────┘
```

1. **Ingest** — Add your product, cost, market location, and target margin.
2. **Analyze** — The model resolves a category profile, location price index, and seasonal signal.
3. **Forecast** — A margin floor, competitor benchmark, and seasonal anchor are blended into a recommendation with a confidence score.
4. **Act** — Review the report, export it as CSV/PDF, or model the impact in the scenario builder.
5. **Learn** — Tune the margin floor and automation rules to match your business.

### 🧮 Deterministic pricing model

The public demo deliberately ships **no API key and no network calls**. `SimulatedBackend.analyzePrice()` (in `index.tsx`) computes:

| Signal | How it is derived |
| --- | --- |
| Margin floor | `cost × 1.10`, and `cost / (1 − target margin)` for the list-price target |
| Competitor benchmark | `cost × category price index × location index × seasonal factor` |
| Seasonality | Current month + market (holiday peak, summer window, festive season in India) |
| Strategy | Value-Based at ≥35% margin, Competitor-Based on a wide price band, otherwise the category default |
| Conversion curve | Constant-elasticity demand model (`−1.5`), revenue max shown as optimal |

Results are deterministic per product (seeded PRNG), so the same input always yields the same report — handy for screenshots, reviews, and tests.

---

## 🚀 Getting Started

### Prerequisites

- Node.js `>= 18` (Node 20 recommended)

No database, cache, or environment variables are required.

### Installation

```bash
git clone https://github.com/sathya1245/Price-Prophet.git
cd Price-Prophet

# Install dependencies
npm install
```

### Run the App

```bash
# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build the production bundle into dist/
npm run build

# Preview the production build locally
npm run preview
```

---

## ☁️ Deployment

The live demo is a static build published to **GitHub Pages**.

```bash
# Build and publish the production bundle to the gh-pages branch
npm run deploy
```

- `npm run deploy` runs `vite build`, then pushes `dist/` to the `gh-pages` branch, which GitHub Pages serves.
- `vite.config.ts` sets `base: './'`, so the same `dist/` folder also works on Netlify, Vercel, Cloudflare Pages, or any static host with no changes.
- Optional: to publish automatically on every push to `main`, add a Pages workflow (`.github/workflows/deploy.yml` using `actions/upload-pages-artifact` + `actions/deploy-pages`) and switch **Settings → Pages → Source** to *GitHub Actions*. Pushing that file requires a token with the `workflow` scope.

---

## 🗺 Roadmap

- [x] Competitor price intelligence with history
- [x] Location-based pricing signals
- [x] Seasonality modelling and confidence scoring
- [x] Scenario modeler, rule engine, and CSV/PDF export
- [ ] Real-time price update streaming (WebSocket)
- [ ] Optional LLM-powered pricing explanations (bring-your-own-key, server-side)
- [ ] Mobile alerts
- [ ] Multi-currency conversion via live FX rates
- [ ] Persistence for saved reports and custom rules

---

<div align="center">

*PriceProphet — because good pricing shouldn't be guesswork.*

</div>
