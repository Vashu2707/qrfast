# QRFast — QR-Based Restaurant Dine-In Ordering System

A production-ready QR dine-in ordering platform built with Next.js 15, Supabase, Prisma, and Razorpay. Customers scan a table QR code to browse the menu, customize orders, pay online or at the counter, and track orders in real time. Restaurant staff manage everything from admin, kitchen, and cashier dashboards.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| State | Zustand (cart), TanStack Query (server data) |
| Backend | Next.js Server Actions & Route Handlers |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL + Prisma ORM |
| Payments | Razorpay |
| Email | Resend (free tier) |
| Deployment | Vercel + Supabase (free tiers) |

## Features

- **Customer**: QR menu, item customization (variants/add-ons), persistent cart, coupons, GST/service charge, Razorpay & pay-at-counter, live order tracking, reviews
- **Admin Dashboard**: Analytics, revenue charts, order management, menu CRUD, table QR generation, coupons, settings
- **Kitchen Display**: Kanban order board, status progression, sound alerts
- **Cashier Desk**: Pending/completed payments, mark paid, complete orders

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd hotel
npm install --legacy-peer-deps
```

### 2. Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` — Your app URL (e.g. `http://localhost:3000`)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID`

### 3. Database Setup

```bash
# Push schema to Supabase
npx prisma db push

# Seed demo data ("The Bistro" with menu, tables, orders)
npx prisma db seed
```

### 4. Supabase Auth Setup

1. Create a Supabase project (free tier)
2. Enable Email auth in Authentication → Providers
3. Create staff users in Supabase Auth matching seed emails:
   - `admin@thebistro.com`
   - `kitchen@thebistro.com`
   - `cashier@thebistro.com`
4. Update the Prisma `User` records with matching Supabase Auth UUIDs if needed

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo URLs

After seeding:

| URL | Description |
|-----|-------------|
| `/` | Marketing landing page |
| `/menu/the-bistro/table-1` | Customer menu (Table 1) |
| `/login` | Staff login |
| `/dashboard` | Admin dashboard |
| `/kitchen` | Kitchen display |
| `/cashier` | Cashier desk |

## Project Structure

```
app/
  (auth)/          # Login, signup, forgot password
  dashboard/       # Admin dashboard pages
  kitchen/         # Kitchen display
  cashier/         # Cashier desk
  menu/[slug]/[table]/  # Customer QR menu
  order/[id]/      # Order tracking
  api/payments/    # Razorpay verify & webhook
actions/           # Server actions
components/
  features/        # Feature-specific UI
  layout/          # Shared layouts
  ui/              # shadcn/ui primitives
hooks/             # Custom hooks (use-cart)
lib/               # Utilities, Supabase, Prisma, Razorpay
prisma/            # Schema & seed
schemas/           # Zod validation schemas
```

## Deployment (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your production domain
5. Deploy

### Razorpay Webhook

Set webhook URL in Razorpay Dashboard:
```
https://yourdomain.com/api/payments/webhook
```

## Production Checklist

- [ ] Set all environment variables in Vercel
- [ ] Run `prisma db push` against production database
- [ ] Configure Supabase RLS policies (optional, app uses server-side auth)
- [ ] Set Razorpay webhook secret
- [ ] Configure Resend domain for email receipts
- [ ] Create real staff accounts in Supabase Auth
- [ ] Test QR flow end-to-end on mobile
- [ ] Enable HTTPS (automatic on Vercel)

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
npx prisma studio  # Database GUI
npx prisma db seed # Seed demo data
```

## License

MIT
