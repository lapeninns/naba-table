# Real Restaurant Contacts Updated ✅

**Date**: October 6, 2025

## Summary

Successfully updated all 8 restaurants with real contact information using the official **lapeninns.com** domain emails.

## Updated Restaurants

### 1. The Queen Elizabeth Pub

- **Domain**: thequeenelizabethpub.co.uk
- **Email**: thequeen@lapeninns.com
- **Phone**: 01553 824083
- **Address**: 32 Gayton Road, Kings Lynn, PE30 4EL

### 2. Old Crown Pub

- **Domain**: oldcrowngirton.com
- **Email**: oldcrown@lapeninns.com
- **Phone**: 01223 276027
- **Address**: 89 High Street, Girton, Cambridge, CB3 0QQ

### 3. White Horse Pub

- **Domain**: whitehorsepub.co
- **Email**: whitehorse@lapeninns.com
- **Phone**: 01223 277217
- **Address**: 89 High Street, Cambridge, CB3 0QD

### 4. The Corner House Pub

- **Domain**: thecornerhousepub.co
- **Email**: cornerhouse@lapeninns.com
- **Phone**: 01223 921122
- **Address**: 231 Newmarket Road, Cambridge, CB5 8JE

### 5. Prince of Wales Pub

- **Domain**: princeofwalesbromham.com
- **Email**: theprince@lapeninns.com
- **Phone**: 01234 822447
- **Mobile**: 07588 864819 (for urgent inquiries)
- **Address**: 8 Northampton Rd, Bedford, MK43 8PE

### 6. The Bell Sawtry

- **Domain**: thebellsawtry.com
- **Email**: thebell@lapeninns.com
- **Phone**: 01487 900149
- **Address**: 82 Green End Road, Sawtry, Huntingdon, PE28 5UY

### 7. The Railway Pub

- **Domain**: therailwaypub.co
- **Email**: therailway@lapeninns.com
- **Phone**: 01733 788345
- **Address**: 139 Station Road, Whittlesey, PE7 1UF

### 8. The Barley Mow Pub

- **Domain**: barleymowhartford.co.uk
- **Email**: barleymow@lapeninns.com
- **Phone**: 01480 450550
- **Mobile**: 07399 835329 (for urgent requests)
- **Address**: 42 Main St, Hartford, Huntingdon, PE29 1XU

## Email System Verification

### Test Results

✅ **The Queen Elizabeth Pub**

- Email: thequeen@lapeninns.com
- Phone: 01553 824083
- Status: Email sent successfully

✅ **Old Crown Pub**

- Email: oldcrown@lapeninns.com
- Phone: 01223 276027
- Status: Email sent successfully

✅ **Prince of Wales Pub**

- Email: theprince@lapeninns.com
- Phone: 01234 822447
- Status: Email sent successfully

✅ **The Barley Mow Pub**

- Email: barleymow@lapeninns.com
- Phone: 01480 450550
- Status: Email sent successfully

### Verified Features

- ✅ All restaurants updated with lapeninns.com email addresses
- ✅ Unique contact details per venue
- ✅ Tenant-specific email system working correctly
- ✅ Booking confirmation emails include correct restaurant contact info
- ✅ Test endpoint `/api/test-email` validates tenant awareness

## Implementation Details

### Database Schema

The following fields were added to the `restaurants` table:

```sql
ALTER TABLE restaurants
  ADD COLUMN contact_email TEXT,
  ADD COLUMN contact_phone TEXT,
  ADD COLUMN address TEXT,
  ADD COLUMN booking_policy TEXT;
```

### Update Script

Created `scripts/update-real-restaurant-contacts.ts`:

- Loads real contact data for all 8 restaurants
- Updates database with lapeninns.com email addresses
- Includes phone numbers, addresses, and booking policies
- Uses Supabase service role for direct database access

### Email Testing

Scripts used for verification:

- `scripts/test-email.ts` - Test single restaurant email
- `scripts/test-all-restaurant-emails.ts` - Test multiple restaurants

## Next Steps

### Production Deployment

1. Deploy updated database schema to production
2. Run `update-real-restaurant-contacts.ts` in production
3. Verify email delivery with actual customer bookings

### Email Configuration

- All booking confirmation emails now use **lapeninns.com** domain
- Each restaurant has unique contact details
- Email templates automatically pull tenant-specific information

### Monitoring

- Track email delivery rates per restaurant
- Monitor for bounced emails to lapeninns.com addresses
- Verify customer experience with new contact information

## Contact Email Mapping

| Restaurant              | Previous Email                         | New Email (lapeninns.com) |
| ----------------------- | -------------------------------------- | ------------------------- |
| The Queen Elizabeth Pub | hellothequeenelizabeth@gmail.com       | thequeen@lapeninns.com    |
| Old Crown Pub           | reservations@oldcrownpub.co.uk         | oldcrown@lapeninns.com    |
| White Horse Pub         | Hellothewhitehorsewaterbeach@gmail.com | whitehorse@lapeninns.com  |
| The Corner House Pub    | hellothecornerhouse@gmail.com          | cornerhouse@lapeninns.com |
| Prince of Wales Pub     | helloprinceofwales@gmail.com           | theprince@lapeninns.com   |
| The Bell Sawtry         | hello@thebellsawtry.com                | thebell@lapeninns.com     |
| The Railway Pub         | hellotherailway@gmail.com              | therailway@lapeninns.com  |
| The Barley Mow Pub      | hellothebarleymow@gmail.com            | barleymow@lapeninns.com   |

## Files Modified

### Scripts Created

- ✅ `scripts/update-real-restaurant-contacts.ts` - Update restaurant contacts with real data

### Database Migrations

- ✅ `20241105000018_add_restaurant_contact_fields.sql` - Added contact fields to restaurants table

### Configuration

- Uses existing `.env.local` for Supabase credentials
- Dotenv package handles environment variable loading
- Service role key provides direct database access

## Success Criteria

- [x] All 8 restaurants have unique lapeninns.com email addresses
- [x] Phone numbers match official contact information
- [x] Physical addresses are accurate
- [x] Booking policies are restaurant-specific
- [x] Email system tested and verified working
- [x] Tenant-specific information confirmed in test emails
- [x] Database successfully updated
- [x] Scripts documented and reusable

---

**Status**: ✅ Complete

All restaurants now have real contact information using the official lapeninns.com domain. The tenant-specific email system has been verified and is working correctly.
