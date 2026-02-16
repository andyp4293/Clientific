# Business Hours Optimization Plan

## Current Structure (7 rows per business)
```prisma
model BusinessHours {
  id         String   @id @default(cuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  dayOfWeek  Int      // 0 = Sunday, 6 = Saturday
  isOpen     Boolean  @default(true)
  openTime   String?  // "09:00"
  closeTime  String?  // "17:00"
  
  @@unique([businessId, dayOfWeek])
}
```

**Problems:**
- 7 database rows per business
- 7 database queries to fetch all hours
- More complex updates

## Proposed Structure (1 row per business)
```prisma
model BusinessHours {
  id         String   @id @default(cuid())
  businessId String   @unique
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  // JSON structure for all 7 days
  hours      Json     @default("{\"0\":{\"isOpen\":false},\"1\":{\"isOpen\":true,\"openTime\":\"09:00\",\"closeTime\":\"17:00\"},\"2\":{\"isOpen\":true,\"openTime\":\"09:00\",\"closeTime\":\"17:00\"},\"3\":{\"isOpen\":true,\"openTime\":\"09:00\",\"closeTime\":\"17:00\"},\"4\":{\"isOpen\":true,\"openTime\":\"09:00\",\"closeTime\":\"17:00\"},\"5\":{\"isOpen\":true,\"openTime\":\"09:00\",\"closeTime\":\"17:00\"},\"6\":{\"isOpen\":false}}")
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**JSON Structure Example:**
```json
{
  "0": { "isOpen": false }, // Sunday - closed
  "1": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }, // Monday
  "2": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }, // Tuesday
  "3": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }, // Wednesday
  "4": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }, // Thursday
  "5": { "isOpen": true, "openTime": "09:00", "closeTime": "17:00" }, // Friday
  "6": { "isOpen": false } // Saturday - closed
}
```

## Benefits
✅ **1 row instead of 7** - 85% reduction in database rows
✅ **Single query** - Fetch all hours at once
✅ **Atomic updates** - Update all days in one transaction
✅ **Better performance** - Less database overhead
✅ **Simpler queries** - No joins needed

## Migration Steps

### 1. Create Migration Script
```typescript
// scripts/migrate-business-hours.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateBusinessHours() {
  const businesses = await prisma.business.findMany({
    include: { businessHours: true }
  });

  for (const business of businesses) {
    // Convert 7 rows to JSON structure
    const hoursJson: any = {};
    
    for (let day = 0; day <= 6; day++) {
      const dayHours = business.businessHours.find(h => h.dayOfWeek === day);
      if (dayHours) {
        hoursJson[day] = {
          isOpen: dayHours.isOpen,
          ...(dayHours.isOpen && {
            openTime: dayHours.openTime,
            closeTime: dayHours.closeTime
          })
        };
      } else {
        hoursJson[day] = { isOpen: false };
      }
    }

    // Create new single-row record (new table)
    await prisma.businessHoursNew.create({
      data: {
        businessId: business.id,
        hours: hoursJson
      }
    });
  }

  console.log('Migration complete!');
}
```

### 2. Update Schema
```bash
# Create new model
prisma migrate dev --name add_business_hours_json

# After verification, drop old table
prisma migrate dev --name drop_old_business_hours
```

### 3. Update API Endpoints
- `/api/business-hours` - Return JSON instead of array
- Available slots API - Parse JSON structure
- Business registration - Create single row with default JSON

### 4. Update UI
- Business hours page - Work with JSON structure
- No UI changes needed (same day-by-day interface)

## Alternative: Keep Current Structure BUT Add Index
If you prefer to keep the relational structure but improve performance:

```prisma
model BusinessHours {
  // ...existing fields...
  
  @@index([businessId, dayOfWeek])
  @@unique([businessId, dayOfWeek])
}
```

This keeps data normalized but adds performance optimization.

## Recommendation
**Option 1 (JSON)** if:
- You prioritize simplicity and fewer rows
- Business hours are always accessed as a complete set
- You don't need to query "all businesses open on Monday"

**Option 2 (Keep current + index)** if:
- You need to query across businesses by day
- You prefer normalized data
- 7 rows per business is acceptable
