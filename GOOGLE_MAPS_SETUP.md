# 🗺️ Google Maps API Setup for Address Autocomplete

## Why Google Maps API?

Your registration form now includes **professional address autocomplete** that:
- ✅ Suggests addresses as users type
- ✅ Auto-fills city, state, zip code, and country
- ✅ Validates real addresses
- ✅ Improves user experience significantly

---

## 🔑 Getting Your API Key (FREE)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"**
4. Name it **"ClientFlow"**
5. Click **"Create"**

### Step 2: Enable Places API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"Places API"**
3. Click on **"Places API"**
4. Click **"Enable"**

### Step 3: Get Your API Key

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the API key that appears
4. Click **"Restrict Key"** (important for security!)

### Step 4: Restrict Your API Key

**Application restrictions:**
- Select **"HTTP referrers (web sites)"**
- Add these referrers:
  - `http://localhost:3000/*` (for local development)
  - `https://clientflow-theta.vercel.app/*` (for production)
  - `https://*.vercel.app/*` (for preview deployments)

**API restrictions:**
- Select **"Restrict key"**
- Choose **"Places API"** from the dropdown
- Click **"Save"**

---

## 💻 Add to Your Local Environment

1. Open `.env` file
2. Add your API key:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-api-key-here"
   ```
3. Restart your dev server

---

## 🚀 Add to Vercel Production

Run this command:
```powershell
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production
```

When prompted, paste your API key.

Then redeploy:
```powershell
vercel --prod
```

---

## 💰 Pricing (It's FREE!)

**Google Maps Platform offers:**
- ✅ **$200 FREE credit every month**
- ✅ **28,500 autocomplete requests per month FREE**
- ✅ No credit card required to start
- ✅ Only pay if you exceed $200/month (unlikely for most businesses)

**Typical usage:**
- 1,000 registrations/month = ~$5 worth (covered by free credit)
- You'd need **28,000+ registrations/month** to pay anything

---

## 🔒 Security Best Practices

✅ **Restrict your API key** (see Step 4 above)  
✅ **Never commit API keys** to Git (already in `.gitignore`)  
✅ **Use environment variables** (already configured)  
✅ **Monitor usage** in Google Cloud Console  

---

## 🧪 Testing Without API Key

The component works without an API key! It will:
- Show a regular text input
- Still allow manual address entry
- Display a warning in the console (dev mode only)

**To test the autocomplete:**
1. Get a free API key (takes 5 minutes)
2. Add it to `.env`
3. Restart dev server
4. Try typing an address on the registration page

---

## 📊 Monitor Usage

Check your usage at:
https://console.cloud.google.com/google/maps-apis/metrics

You'll see:
- Number of requests
- Cost per request
- Remaining free credit

---

## 🐛 Troubleshooting

**Autocomplete not working?**
- ✅ Check API key is correct in `.env`
- ✅ Ensure Places API is enabled
- ✅ Restart dev server after adding key
- ✅ Check browser console for errors
- ✅ Verify API key restrictions allow your domain

**Getting billing errors?**
- You need to enable billing in Google Cloud (but you won't be charged unless you exceed $200/month)
- The $200 free credit automatically applies

---

## 📚 Links

- [Google Maps Platform](https://mapsplatform.google.com/)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)

---

**Need Help?** The address autocomplete will work without the API key (just as a regular input). Add the key when you're ready to deploy!
