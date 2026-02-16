# Deployment Instructions

## Current Status

✅ **Development Server**: Ready to start with `npm run dev`
✅ **Build**: Successful (`.next` folder exists)
✅ **Vercel CLI**: Installed and configured
✅ **Application**: Updated with beautiful date/time pickers

## Starting the Development Server

### Option 1: PowerShell (Recommended for Windows)
```powershell
cd c:\Users\andyp\Desktop\ClientFlow
npm run dev
```

The dev server will start at `http://localhost:3000`

### Option 2: Command Prompt
```cmd
cd c:\Users\andyp\Desktop\ClientFlow
npm run dev
```

## Building for Production

```bash
npm run build
```

This runs:
1. `prisma generate` - Generates Prisma client
2. `next build` - Builds Next.js application

Output: `.next/` folder (ready for deployment)

## Deploying to Vercel

### Option 1: Using Vercel CLI (Automatic Deployment)
```bash
vercel deploy --prod
```

This will:
1. Build your application
2. Deploy to your Vercel project
3. Set production environment

### Option 2: Push to GitHub & Auto-Deploy
If your repo is connected to Vercel:
```bash
git add .
git commit -m "Add beautiful date/time pickers"
git push
```

Vercel will automatically build and deploy on push to main branch.

### Option 3: Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your `clientflow` project
3. Click "Deployments" tab
4. Click "Deploy" to redeploy latest

## Environment Variables

Make sure your `.env` file has:
- `DATABASE_URL` - PostgreSQL connection
- `DIRECT_URL` - Direct database URL
- `NEXTAUTH_SECRET` - Session secret
- `NEXTAUTH_URL` - Your deployed URL
- `STRIPE_*` keys - Stripe integration
- `GOOGLE_MAPS_API_KEY` - Maps API

## What's New in This Deployment

### 🎨 Beautiful Date/Time Pickers
- **DatePicker.tsx** - Calendar-based date selection with month navigation
- **TimePicker.tsx** - Spinner-based time selection with quick presets

### 📍 Where They're Used
1. **Public Booking Page** (`/book/[slug]`) - Date selection
2. **Business Hours Dashboard** (`/dashboard/business-hours`) - Time selection

### 🔧 No Breaking Changes
- All existing APIs work the same
- No database schema changes
- Pure UI improvements

## Testing Before Deployment

1. Start dev server: `npm run dev`
2. Test booking flow: Navigate to a booking link
3. Test business hours: Go to dashboard → Business Hours
4. Verify date/time pickers look beautiful ✨
5. Check mobile responsiveness

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -r .next
rm -r node_modules
npm install
npm run build
```

### Deployment Stuck
```bash
# Force re-deploy
vercel deploy --prod --force
```

### Environment Variables Missing
1. Go to Vercel Dashboard
2. Project Settings → Environment Variables
3. Add missing variables
4. Redeploy

## Production URL

Your app will be available at:
- **Primary**: https://clientflow-chi.vercel.app (or your custom domain)
- **Preview**: Generated for each deploy

## After Deployment

### Update Auth URLs
If using a custom domain:
1. Update `NEXTAUTH_URL` environment variable
2. Update OAuth provider redirect URIs (Google, etc.)

### Set Up Custom Domain
1. Vercel Dashboard → Project Settings → Domains
2. Add your domain (e.g., `clientflow.com`)
3. Update DNS records

### Monitor Deployment
- Vercel Dashboard → Deployments
- Check build logs
- Monitor Edge Functions
- View analytics

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run lint            # Run linter

# Database
npm run db:push         # Sync schema with database
npm run db:studio       # Open Prisma Studio
npm run db:generate     # Generate Prisma client

# Production
npm run build           # Build for production
npm start               # Start production server (local)

# Deployment
vercel deploy           # Deploy preview
vercel deploy --prod    # Deploy to production
vercel env pull         # Pull environment variables
vercel logs             # View deployment logs
```

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs
- NextAuth.js Docs: https://next-auth.js.org
