# ClientFlow Development Roadmap

This document provides a step-by-step guide for completing the ClientFlow application.

## Phase 1: Customer Management (3-5 days)

### 1.1 Customer List Page
**File**: `src/app/(dashboard)/dashboard/customers/page.tsx`

**Features**:
- Table with columns: Name, Phone, Email, Segment, Last Visit, Total Visits, Points, Actions
- Search bar (searches name, phone, email)
- Filter dropdowns: Segment, Date range
- Pagination (50 per page)
- "Add Customer" button
- Export to CSV button

**API Route**: `src/app/api/customers/route.ts`
- GET: List customers with filters
- POST: Create new customer

### 1.2 Add/Edit Customer Modal
**File**: `src/components/customers/CustomerModal.tsx`

**Form Fields**:
- First name (required)
- Last name (required)
- Phone (required, formatted)
- Email (optional)
- Birthday (date picker)
- Initial points (optional)
- Notes (textarea)
- Marketing opt-in (checkbox)

### 1.3 Customer Detail Page
**File**: `src/app/(dashboard)/dashboard/customers/[id]/page.tsx`

**Sections**:
- Header: Name, segment badge, stats
- Tabs: Visit History, Reviews, Appointments, Points History, Activity
- Actions: Edit, Send SMS, Book Appointment, Delete

**API Routes**:
- GET `/api/customers/[id]`
- PUT `/api/customers/[id]`
- DELETE `/api/customers/[id]`
- GET `/api/customers/[id]/history`

---

## Phase 2: Check-In System (2-3 days)

### 2.1 Manual Check-In Modal
**File**: `src/components/checkins/CheckInModal.tsx`

**Flow**:
1. Enter phone number
2. System searches for customer
3. If found: Show customer info, allow check-in
4. If new: Quick registration form
5. Select service (optional)
6. Enter amount spent (optional)
7. System calculates points
8. Complete check-in

**API Route**: `src/app/api/checkins/route.ts`
- POST: Create check-in
- Updates customer stats (totalVisits, lastVisit, totalSpent, points)
- Creates points transaction
- Updates customer segment

### 2.2 Check-In History Page
**File**: `src/app/(dashboard)/dashboard/checkins/page.tsx`

**Features**:
- Table: Date, Customer, Service, Amount, Points, Staff, Actions
- Filter by date range, customer, service
- Edit/delete check-in
- Export to CSV

### 2.3 Public Kiosk Page
**File**: `src/app/checkin/[slug]/page.tsx`

**UI**:
- Large "Enter Your Phone" heading
- Number pad (0-9 buttons)
- Submit button
- Auto-resets after 5 seconds
- No navigation visible (full-screen)

---

## Phase 3: Review Management (4-5 days)

### 3.1 Reviews List Page
**File**: `src/app/(dashboard)/dashboard/reviews/page.tsx`

**Features**:
- List of all reviews
- Show: Stars, customer, date, comment, status
- Filter: By rating, sentiment, date, status
- Click to view detail/respond

**API Route**: `src/app/api/reviews/route.ts`
- GET: List reviews with filters

### 3.2 Review Detail & Response
**File**: `src/app/(dashboard)/dashboard/reviews/[id]/page.tsx`

**Features**:
- Full review display
- Respond button opens textarea
- Send response via SMS
- Mark as addressed

**API Route**: `src/app/api/reviews/[id]/respond`
- POST: Send response, update review

### 3.3 Review Settings
**File**: `src/app/(dashboard)/dashboard/settings/reviews/page.tsx`

**Settings**:
- Enable/disable auto requests (toggle)
- Delay after check-in (dropdown)
- SMS templates (3 textareas: initial, positive, negative)
- Google review link (input)
- Test send button

### 3.4 Public Review Submission
**File**: `src/app/review/[token]/page.tsx`

**Flow**:
1. Customer clicks SMS link
2. Shows business name
3. Select rating (1-5 stars)
4. If 4-5: Show "Share on Google?" with link
5. If 1-3: Show "Tell us what went wrong" textarea
6. Submit → Thank you message

**API Route**: `src/app/api/reviews/[token]/route.ts`
- GET: Verify token, get review info
- POST: Submit rating/comment

### 3.5 Background Job: Review Requests
**File**: `src/app/api/cron/review-requests/route.ts`

**Logic**:
```typescript
// Run every 15 minutes
// Find check-ins from X hours ago (configurable delay)
// Where feedbackRequested = false
// Generate unique token
// Send SMS with review link
// Mark feedbackRequested = true
```

---

## Phase 4: Appointment Booking (5-7 days)

### 4.1 Calendar View
**File**: `src/app/(dashboard)/dashboard/appointments/page.tsx`

**Features**:
- Full calendar (use a library like `react-big-calendar`)
- Day/Week/Month views
- Color-coded by service or staff
- Click slot to create appointment
- Click appointment to edit
- Drag to reschedule

### 4.2 Create Appointment Modal
**File**: `src/components/appointments/AppointmentModal.tsx`

**Form**:
- Search/select customer (autocomplete)
- Select service (dropdown)
- Select date (date picker)
- Select time (time picker with 15-min intervals)
- Duration (auto-filled from service, editable)
- Assign staff (optional dropdown)
- Notes (textarea)
- Send confirmation SMS (checkbox, default checked)

**API Routes**:
- POST `/api/appointments`
- PUT `/api/appointments/[id]`
- DELETE `/api/appointments/[id]`

### 4.3 Appointments List View
**File**: `src/app/(dashboard)/dashboard/appointments/list/page.tsx`

**Features**:
- Alternative to calendar
- Upcoming/Past tabs
- Filter: Customer, service, staff, date, status
- Actions: Reschedule, cancel, mark complete, mark no-show

### 4.4 Booking Availability API
**File**: `src/app/api/appointments/availability/route.ts`

**Logic**:
```typescript
// Given: businessId, date, serviceId
// Return: Available time slots
// Consider: Business hours, existing appointments, buffer time
```

### 4.5 Public Booking Page
**File**: `src/app/booking/[slug]/page.tsx`

**Flow**:
1. Show business info
2. Select service
3. Select date (show calendar)
4. Show available time slots
5. Customer enters: Name, phone, email
6. Confirm booking
7. Send confirmation SMS

**API Route**: `src/app/api/public/booking/route.ts`
- POST: Create appointment for public user

### 4.6 Background Job: Reminders
**File**: `src/app/api/cron/reminders/route.ts`

**Logic**:
```typescript
// Run hourly
// Find appointments in next 24 hours
// Where reminderSent = false
// Send SMS reminder
// Mark reminderSent = true
```

---

## Phase 5: Loyalty & Rewards (3-4 days)

### 5.1 Rewards List Page
**File**: `src/app/(dashboard)/dashboard/rewards/page.tsx`

**Features**:
- Cards showing all rewards
- Display: Name, points cost, times redeemed, active status
- Create/Edit/Delete buttons

### 5.2 Create Reward Modal
**File**: `src/components/rewards/RewardModal.tsx`

**Form**:
- Reward name
- Description
- Points cost
- Reward type (dropdown: Discount %, Discount $, Free Service, Free Item)
- Reward value
- Expiration days (optional)
- Active toggle

**API Routes**:
- GET `/api/rewards`
- POST `/api/rewards`
- PUT `/api/rewards/[id]`
- DELETE `/api/rewards/[id]`

### 5.3 Redemption Interface
**File**: `src/components/customers/RedeemRewardModal.tsx`

**Flow**:
1. Open from customer detail page
2. Show available rewards (customer has enough points)
3. Select reward
4. Confirm redemption
5. Generate code
6. Deduct points
7. Show success with code

**API Route**: `src/app/api/rewards/redeem/route.ts`
- POST: Create redemption, deduct points, generate code

### 5.4 Points Configuration
**File**: `src/app/(dashboard)/dashboard/settings/loyalty/page.tsx`

**Settings**:
- Points per dollar spent
- Points per visit
- Referral bonus points
- Enable/disable system

---

## Phase 6: Marketing Campaigns (4-5 days)

### 6.1 Campaigns List
**File**: `src/app/(dashboard)/dashboard/campaigns/page.tsx`

**Features**:
- List all campaigns
- Show: Name, type, status, scheduled date, recipients, delivery stats
- Create button

### 6.2 Create Campaign Wizard
**File**: `src/app/(dashboard)/dashboard/campaigns/create/page.tsx`

**Steps**:
1. Campaign name & type
2. Message template (with variables: {firstName}, {businessName}, {points})
3. Target audience (select segments, filters)
4. Schedule (now or pick date/time)
5. Review & send

**API Routes**:
- POST `/api/campaigns`
- POST `/api/campaigns/[id]/send`

### 6.3 Campaign Detail & Stats
**File**: `src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`

**Show**:
- Campaign details
- Message content
- Recipients count
- Delivery stats (sent, delivered, failed)
- List of recipients

### 6.4 Background Jobs
**Files**:
- `src/app/api/cron/birthday-campaigns/route.ts`
- `src/app/api/cron/send-campaigns/route.ts`

**Birthday Logic**:
```typescript
// Run daily at 9 AM
// Find customers with birthday = today
// Where optedInMarketing = true
// Send birthday SMS
```

---

## Phase 7: Business Settings (3-4 days)

### 7.1 Business Profile
**File**: `src/app/(dashboard)/dashboard/settings/business/page.tsx`

**Form**:
- Business name, type, phone, email
- Address fields
- Timezone
- Logo upload
- Social media links
- Save button

### 7.2 Services Management
**File**: `src/app/(dashboard)/dashboard/settings/services/page.tsx`

**Features**:
- List of services
- Add/Edit/Delete modals
- Drag to reorder
- Active/Inactive toggle

### 7.3 Staff Management
**File**: `src/app/(dashboard)/dashboard/settings/staff/page.tsx`

**Features**:
- List of staff members
- Add/Edit/Delete
- Role assignment (Admin/Staff)
- Active/Inactive toggle

### 7.4 Business Hours
**File**: `src/app/(dashboard)/dashboard/settings/hours/page.tsx`

**UI**:
- Grid: 7 days
- For each day: Open toggle, start time, end time

### 7.5 Notification Preferences
**File**: `src/app/(dashboard)/dashboard/settings/notifications/page.tsx`

**Toggles**:
- Email notifications (per type)
- SMS notifications (to business owner)

---

## Phase 8: Subscription & Billing (5-6 days)

### 8.1 Stripe Setup
**File**: `src/lib/stripe.ts`

```typescript
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

### 8.2 Subscription Dashboard
**File**: `src/app/(dashboard)/dashboard/billing/page.tsx`

**Display**:
- Current plan & price
- Billing period
- Next payment date
- Trial status (if applicable)
- Upgrade/Downgrade buttons
- Cancel button

### 8.3 Stripe Checkout
**Flow**:
1. User clicks "Upgrade to Pro"
2. Create Stripe Checkout Session
3. Redirect to Stripe hosted page
4. Customer enters payment info
5. Redirect back to success page
6. Webhook updates subscription status

**API Routes**:
- POST `/api/subscription/create-checkout`
- POST `/api/webhooks/stripe` (webhook handler)

### 8.4 Webhook Handler
**File**: `src/app/api/webhooks/stripe/route.ts`

**Events to handle**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 8.5 Trial Expiration
**Logic**:
- Check if trial ended
- If no payment method: Lock account, show modal
- Send email reminders (3 days before, 1 day before)

---

## Phase 9: Analytics & Reports (4-5 days)

### 9.1 Analytics Dashboard
**File**: `src/app/(dashboard)/dashboard/analytics/page.tsx`

**Components**:
- Date range picker
- Key metrics cards (with % change)
- Line chart: Revenue over time
- Line chart: Check-ins over time
- Pie chart: Customer segments
- Bar chart: Review ratings
- Heatmap: Peak hours
- Bar chart: Top services

### 9.2 Data Queries
**File**: `src/lib/analytics.ts`

**Functions**:
- `getRevenueData(businessId, startDate, endDate)`
- `getCheckInData(businessId, startDate, endDate)`
- `getCustomerGrowth(businessId, startDate, endDate)`
- `getRetentionRate(businessId, startDate, endDate)`
- `getChurnRate(businessId, startDate, endDate)`

### 9.3 Export Features
**API Route**: `src/app/api/export/route.ts`

**Endpoints**:
- GET `/api/export/customers` → CSV
- GET `/api/export/checkins` → CSV
- GET `/api/export/reviews` → CSV
- GET `/api/export/appointments` → CSV

---

## Phase 10: Twilio Integration (2-3 days)

### 10.1 Twilio Setup
**File**: `src/lib/twilio.ts`

```typescript
import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(to: string, message: string) {
  // Send SMS
  // Log to SmsLog table
  // Return result
}
```

### 10.2 Incoming SMS Webhook
**File**: `src/app/api/webhooks/twilio/route.ts`

**Handle**:
- STOP → Opt out customer
- CONFIRM → Confirm appointment
- CANCEL → Cancel appointment
- 1-5 (rating) → Submit review

### 10.3 SMS Log Page
**File**: `src/app/(dashboard)/dashboard/sms-logs/page.tsx`

**Display**:
- Table of all SMS sent
- Columns: Date, To, Type, Message, Status
- Filter by date, type, status

---

## Phase 11: Polish & Optimization (3-5 days)

### 11.1 Mobile Optimization
- Implement bottom navigation
- Test all flows on mobile
- Adjust spacing, font sizes
- Touch-friendly buttons

### 11.2 Empty States
- Design and implement empty states for all list pages
- Helpful CTAs in empty states
- Onboarding tooltips

### 11.3 Loading States
- Add skeleton screens
- Loading spinners
- Progress indicators

### 11.4 Error Handling
- Toast notifications for success/error
- Friendly error messages
- Retry mechanisms
- Form validation errors

### 11.5 Performance
- Add database indexes
- Implement pagination everywhere
- Optimize queries (select only needed fields)
- Image optimization
- Code splitting

### 11.6 Testing
- Test registration flow end-to-end
- Test check-in flow
- Test appointment booking
- Test SMS sending (with real Twilio)
- Test Stripe integration (test mode)
- Test on multiple devices

---

## Phase 12: Deployment (2-3 days)

### 12.1 Production Database
- Set up Neon/Supabase/Railway
- Run migrations
- Update DATABASE_URL

### 12.2 Environment Variables
- Set all required env vars in Vercel
- Generate production NEXTAUTH_SECRET
- Add production Stripe keys
- Add production Twilio credentials

### 12.3 Deploy to Vercel
- Push code to GitHub
- Connect to Vercel
- Deploy
- Test production site

### 12.4 Post-Deploy
- Set up Stripe webhook in production
- Set up Twilio webhook in production
- Test end-to-end flows
- Monitor for errors

---

## Estimated Timeline

**Total Development Time**: 8-12 weeks (solo developer)

- **Week 1-2**: Customer Management & Check-Ins
- **Week 3-4**: Reviews & Automation
- **Week 5-6**: Appointments & Booking
- **Week 7**: Loyalty & Rewards
- **Week 8**: Marketing Campaigns
- **Week 9**: Settings & Business Profile
- **Week 10**: Billing & Stripe
- **Week 11**: Analytics & Reports
- **Week 12**: Polish, Testing, Deployment

## Priority Order (MVP First)

If you want to launch an MVP quickly, build in this order:

1. **Customer Management** (can't do anything without this)
2. **Check-In System** (core value proposition)
3. **Review Requests** (main differentiation)
4. **Twilio Integration** (required for reviews)
5. **Basic Settings** (business hours, services)

Then launch beta and gather feedback before building:

6. Appointments
7. Loyalty
8. Campaigns
9. Billing
10. Analytics

## Tips for Success

1. **Build one feature completely before moving to the next**
2. **Test each feature thoroughly as you go**
3. **Use Prisma Studio to verify database changes**
4. **Start with fake data, then add real integrations**
5. **Deploy early and often to catch issues**
6. **Get user feedback on each major feature**
7. **Don't skip error handling**
8. **Write tests for critical flows**

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Twilio SMS API**: https://www.twilio.com/docs/sms
- **Stripe Subscriptions**: https://stripe.com/docs/billing/subscriptions/overview
- **React Big Calendar**: https://github.com/jquense/react-big-calendar
- **Chart Libraries**: recharts, Chart.js, or Tremor

---

**You've got this! The foundation is solid. Now it's just feature by feature. 🚀**
