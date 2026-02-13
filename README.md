# ClientFlow - Customer Management & Review Platform

A complete SaaS web application for service businesses to manage customers, reviews, appointments, and loyalty programs.

## Features

- 🔐 **Authentication** - Secure login and registration with NextAuth.js
- 👥 **Customer Management** - Track customers with automatic segmentation (NEW, REGULAR, VIP, AT_RISK, CHURNED)
- ✅ **Check-In System** - Quick customer check-in with points tracking
- ⭐ **Review Management** - Automated review requests via SMS, route positive reviews to Google
- 📅 **Appointment Booking** - Online booking with SMS reminders and confirmations
- 🎁 **Loyalty Rewards** - Points-based rewards program
- 📱 **SMS Campaigns** - Targeted marketing campaigns via Twilio
- 📊 **Analytics Dashboard** - Business insights and performance metrics
- 💳 **Subscription Billing** - Stripe integration for subscription management

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **SMS**: Twilio API
- **Email**: Resend
- **Payments**: Stripe
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Twilio account (for SMS features)
- Stripe account (for payments)
- Resend account (for emails)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ClientFlow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/clientflow"

   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-change-this"

   # Twilio (optional for development)
   TWILIO_ACCOUNT_SID="your-twilio-sid"
   TWILIO_AUTH_TOKEN="your-twilio-token"
   TWILIO_PHONE_NUMBER="your-twilio-phone"

   # Stripe (optional for development)
   STRIPE_SECRET_KEY="your-stripe-secret"
   STRIPE_PUBLISHABLE_KEY="your-stripe-publishable"
   STRIPE_WEBHOOK_SECRET="your-webhook-secret"

   # Resend (optional for development)
   RESEND_API_KEY="your-resend-key"
   RESEND_FROM_EMAIL="noreply@yourdomain.com"
   ```

4. **Set up the database**
   ```bash
   # Push the Prisma schema to your database
   npm run db:push

   # Generate Prisma Client
   npm run db:generate
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Setup

### Local PostgreSQL (Recommended for Development)

1. **Install PostgreSQL**
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Create a database**
   ```bash
   psql postgres
   CREATE DATABASE clientflow;
   CREATE USER clientflow_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE clientflow TO clientflow_user;
   ```

3. **Update your DATABASE_URL** in `.env`
   ```
   DATABASE_URL="postgresql://clientflow_user:your_password@localhost:5432/clientflow"
   ```

### Cloud Database Options

- **Neon** (Free tier): [neon.tech](https://neon.tech)
- **Supabase** (Free tier): [supabase.com](https://supabase.com)
- **Railway** (Free trial): [railway.app](https://railway.app)
- **Vercel Postgres**: [vercel.com/storage/postgres](https://vercel.com/storage/postgres)

## Project Structure

```
ClientFlow/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Dashboard pages (protected)
│   │   ├── api/               # API routes
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Homepage
│   ├── components/
│   │   ├── layout/            # Layout components
│   │   ├── providers/         # Context providers
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── segmentation.ts    # Customer segmentation logic
│   │   └── utils.ts           # Utility functions
│   └── types/
│       └── next-auth.d.ts     # TypeScript type definitions
├── .env                       # Environment variables
├── .env.example               # Example environment variables
├── next.config.js             # Next.js configuration
├── package.json               # Dependencies
├── tailwind.config.ts         # Tailwind CSS configuration
└── tsconfig.json              # TypeScript configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push Prisma schema to database
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:generate` - Generate Prisma Client

## Features Implementation Status

### ✅ Completed
- [x] Authentication (Login/Register)
- [x] Dashboard layout and navigation
- [x] Database schema (Prisma)
- [x] Customer segmentation logic
- [x] Dashboard stats and metrics

### 🚧 In Progress
- [ ] Customer management (list, add, edit, delete)
- [ ] Check-in system
- [ ] Review management
- [ ] Appointment booking
- [ ] Loyalty rewards
- [ ] SMS campaigns
- [ ] Stripe integration
- [ ] Analytics and reports

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add environment variables**
   - In Vercel dashboard, go to Settings > Environment Variables
   - Add all variables from your `.env` file

4. **Deploy**
   - Vercel will automatically build and deploy your app
   - Your app will be live at `your-project.vercel.app`

### Database for Production

Make sure to use a production-ready PostgreSQL database:
- Neon, Supabase, or Railway (recommended)
- Update `DATABASE_URL` in Vercel environment variables

## Support & Documentation

- **Prisma**: [prisma.io/docs](https://www.prisma.io/docs)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **NextAuth.js**: [next-auth.js.org](https://next-auth.js.org)
- **Tailwind CSS**: [tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Twilio**: [twilio.com/docs](https://www.twilio.com/docs)
- **Stripe**: [stripe.com/docs](https://stripe.com/docs)

