# Vercel Environment Variables

## Required Environment Variables for Production

Add these to your Vercel project settings at: https://vercel.com/your-project/settings/environment-variables

### Database (Required)
```
DATABASE_URL="postgresql://neondb_owner:npg_zrPJWfqd74Ie@ep-broad-lake-aif4myzz-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

DIRECT_URL="postgresql://neondb_owner:npg_zrPJWfqd74Ie@ep-broad-lake-aif4myzz.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### NextAuth (Required)
```
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="generate-a-secure-random-string-here"
```
**Note:** Generate NEXTAUTH_SECRET with: `openssl rand -base64 32`

### Twilio SMS (Required for SMS notifications)
```
TWILIO_ACCOUNT_SID="ACd831cb967905f383db822a1b6600664c"
TWILIO_AUTH_TOKEN="6cbabc3f08bb8f159b543b50fbccb520"
TWILIO_PHONE_NUMBER="+18555524287"
```

### Mapbox (Required for address autocomplete)
```
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="pk.eyJ1IjoiYW5keXA0MjkzIiwiYSI6ImNtbGxhY3Z1djA1Y3EzZG9oNjN1OWtiNTMifQ.1QZ8tfAVMi9ZtAmrQLSt3Q"
```

### Stripe (Optional - for payments)
```
STRIPE_SECRET_KEY="sk_live_your_production_key_here"
STRIPE_PUBLISHABLE_KEY="pk_live_your_production_key_here"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_your_production_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Price IDs (create these in Stripe dashboard)
STRIPE_STARTER_PRICE_ID="price_starter_id"
STRIPE_PRO_PRICE_ID="price_pro_id"
STRIPE_PREMIUM_PRICE_ID="price_premium_id"
```

### Resend Email (Optional - for email notifications)
```
RESEND_API_KEY="re_your_api_key_here"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### App Configuration (Required)
```
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

---

## How to Add Environment Variables to Vercel

1. Go to https://vercel.com
2. Select your **ClientFlow** project
3. Click **Settings** → **Environment Variables**
4. Add each variable above with:
   - **Key**: Variable name (e.g., `TWILIO_ACCOUNT_SID`)
   - **Value**: The actual value
   - **Environment**: Select **Production**, **Preview**, and **Development**
5. Click **Save**
6. After adding all variables, go to **Deployments** and click **Redeploy** on the latest deployment

---

## Important Notes

### For Production:
- ✅ **Change NEXTAUTH_SECRET** to a secure random string (use `openssl rand -base64 32`)
- ✅ **Update NEXTAUTH_URL** to your actual production domain
- ✅ **Update NEXT_PUBLIC_APP_URL** to your production domain
- ✅ **Use Stripe live keys** instead of test keys
- ⚠️ **Database URLs** are already using production Neon database (be careful!)

### SMS Testing:
- The Twilio credentials provided are using a trial account
- You may need to verify phone numbers in Twilio console
- For production, upgrade to a paid Twilio account

### Deployment Process:
1. Environment variables are set in Vercel
2. Code is automatically deployed when you push to main branch
3. Vercel will build and deploy your app
4. Check deployment logs for any errors

---

## Quick Deploy Command

To trigger a deployment after setting env variables:
```bash
git push origin main
```

Or manually redeploy in Vercel dashboard.

---

## Verification Checklist

After deployment, test these features:
- [ ] User registration and login
- [ ] Business hours configuration
- [ ] Service creation
- [ ] Staff creation
- [ ] Public booking page (https://your-domain.vercel.app/book/your-slug)
- [ ] SMS confirmation when booking (check phone for SMS)
- [ ] Address autocomplete in settings
- [ ] Appointments dashboard

---

## Need Help?

If deployment fails, check:
1. Vercel deployment logs
2. All environment variables are set correctly
3. Database is accessible from Vercel
4. No syntax errors in code (should be clean since we just committed)
