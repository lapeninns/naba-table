# Table Ready Email - "Get Directions" Update

## Change Summary

Updated the **"Table Ready"** email (sent 2 hours before booking) to be more useful by changing the call-to-action from a misleading "I'm Here" button to a practical **"Get Directions"** button that opens Google Maps.

---

## What Changed

### **Before** ❌

```
Email: "Table Ready 🍽️"
Button: "I'm Here"
Action: Opens booking details page (not useful)
```

### **After** ✅

```
Email: "Table Ready 🍽️"
Button: "Get Directions"
Action: Opens Google Maps with restaurant location
```

---

## Implementation Details

### **File Modified**: `server/emails/bookings.ts`

**Lines Changed**: 623-627

```typescript
case 'reminder':
  if (options?.reminderVariant === 'short') { // 2h reminder
    baseHeadline = 'Table Ready 🍽️';
    baseIntro = `We've prepped your table at ${venue.name}. Please head to the host stand when you arrive.`;
    ctaLabel = 'Get Directions';  // ← Changed from "I'm Here"
    ctaUrl = venue.googleMapUrl || manageUrl;  // ← Now links to Google Maps
  }
```

---

## Button Behavior

### **Primary (Preferred)**:

If restaurant has Google Maps URL configured:

```
Button: "Get Directions"
→ Opens: Google Maps with restaurant location
→ User can: Start navigation to the restaurant
```

### **Fallback**:

If no Google Maps URL is set:

```
Button: "Get Directions"
→ Opens: Booking details page (with address visible)
→ User can: Copy address manually
```

---

## Email Types & CTA Summary

| Email Type             | When Sent             | Button Label         | Link Destination   |
| ---------------------- | --------------------- | -------------------- | ------------------ |
| **Request Received**   | Immediately (pending) | "Check Status"       | Booking page       |
| **Booking Confirmed**  | Immediately           | "Manage Booking"     | Booking page       |
| **Tomorrow's the Day** | 24h before            | "Get Directions"     | Google Maps        |
| **Table Ready** 🍽️     | **2h before**         | **"Get Directions"** | **Google Maps** ✅ |
| **How was Dinner?**    | 3h after              | "Leave a Review"     | Google Reviews     |
| **Booking Cancelled**  | On cancellation       | "Book Again"         | Restaurant page    |

---

## Google Maps URL Configuration

### **How It's Set**:

The `google_map_url` is stored in the `restaurants` table:

```sql
SELECT google_map_url FROM restaurants WHERE id = '...';
```

### **Example Google Maps URL**:

```
https://maps.google.com/?q=The+Old+Crown,+Birmingham,+UK
```

Or with Place ID:

```
https://www.google.com/maps/place/?q=place_id:ChIJ...
```

### **Setting in Ops Dashboard**:

Restaurant settings → Contact Information → Google Maps URL

---

## User Experience

### **Guest Journey (2 Hours Before Reservation)**:

1. **Receives email**:

   ```
   Subject: "Table Ready 🍽️ - The Old Crown"

   We've prepped your table at The Old Crown.
   Please head to the host stand when you arrive.

   Date: Tonight
   Time: 7:00 PM

   [Get Directions] ← Button
   ```

2. **Clicks "Get Directions"**:
   - **If on mobile** → Opens Google Maps app
   - **If on desktop** → Opens Google Maps in browser

3. **Starts navigation**:
   - Real-time directions to restaurant
   - Estimated arrival time
   - Traffic conditions

---

## Benefits of This Change

| Aspect               | Before ("I'm Here")   | After ("Get Directions") |
| -------------------- | --------------------- | ------------------------ |
| **Clarity**          | ❌ Misleading name    | ✅ Clear purpose         |
| **Usefulness**       | ❌ Just shows booking | ✅ Helps guest arrive    |
| **Mobile-Friendly**  | ⚠️ No action          | ✅ Opens Maps app        |
| **Guest Experience** | ⚠️ Confusing          | ✅ Helpful               |
| **Conversions**      | ❌ Low engagement     | ✅ Higher click-through  |

---

## Technical Notes

### **Priority Logic**:

```typescript
ctaUrl = venue.googleMapUrl || manageUrl;
```

1. **First choice**: Use restaurant's Google Maps URL
2. **Fallback**: Use booking management page (has address)

### **Google Maps Format**:

The system accepts any of these formats:

- `https://maps.google.com/?q=RESTAURANT_NAME,CITY`
- `https://www.google.com/maps/place/?q=place_id:PLACE_ID`
- `https://goo.gl/maps/SHORT_CODE`

All will open in native Maps app on mobile devices.

---

## Testing

### **Manual Test**:

1. **Create a test booking** for 2 hours from now
2. **Trigger 2h reminder email**:
   ```bash
   # Simulate time progression or manually trigger
   POST /api/cron/process-emails
   ```
3. **Check email**:
   - ✅ Subject: "Table Ready 🍽️"
   - ✅ Button says "Get Directions"
   - ✅ Click opens Google Maps

### **Verify Fallback**:

1. **Remove Google Maps URL** from restaurant:
   ```sql
   UPDATE restaurants
   SET google_map_url = NULL
   WHERE id = 'test-restaurant-id';
   ```
2. **Send email again**
3. **Verify**: Button still works, opens booking page

---

## Related Changes

### **Also Updated 24h Reminder**:

The 24-hour reminder (tomorrow's the day) already had "Get Directions" but we ensured consistency:

```typescript
// 24h reminder
ctaLabel = 'Get Directions';
ctaUrl = venue.googleMapUrl || manageUrl;
```

Both reminder emails now have the same helpful CTA.

---

## Migration Notes

### **No Database Changes Required** ✅

This is a pure code change - no migrations needed.

### **Existing Emails**:

All future emails will use the new CTA. Previously sent emails still have the old "I'm Here" button (but those are already delivered).

---

## Summary

✅ **Changed**: "I'm Here" → "Get Directions"  
✅ **Updated**: CTA now links to Google Maps  
✅ **Improved**: Guest experience and usefulness  
✅ **Maintained**: Fallback to booking page if no Maps URL  
✅ **Build**: Passing

**Status**: Ready for production! 🚀

---

## Example Email Preview

```
┌─────────────────────────────────────────┐
│                                         │
│              The Old Crown              │
│                                         │
│              🍽️                         │
│                                         │
│         Table Ready 🍽️                 │
│                                         │
│  We've prepped your table at The Old    │
│  Crown. Please head to the host stand   │
│  when you arrive.                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Date: Tonight                   │   │
│  │ Time: 7:00 PM                   │   │
│  │ Guests: 2 People                │   │
│  │ Reference: ABC123               │   │
│  └─────────────────────────────────┘   │
│                                         │
│      ┌────────────────────┐            │
│      │  Get Directions →  │            │ ← New!
│      └────────────────────┘            │
│                                         │
│     123 High Street, Birmingham         │
│                                         │
└─────────────────────────────────────────┘
```

Perfect for mobile - tapping "Get Directions" opens Maps app immediately! 📍
