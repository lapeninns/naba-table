# 📧 Local Auth & Magic Links Guide

## 🎯 **Yes, Everything is Local!**

Your entire setup is running locally, including authentication. Here's how it works:

### ✅ What's Running Locally

1. **Supabase Database** - All your restaurant/booking data
2. **Supabase Auth** - Login/signup system
3. **Supabase API** - REST endpoints
4. **Inbucket Email Server** - **This catches all emails!** 📬

## 📬 Where Are Your Magic Link Emails?

**TL;DR: Open Inbucket at http://127.0.0.1:54324**

### The Issue

When you request a magic link in local development:

- ❌ Emails **DON'T** go to your actual inbox
- ✅ Emails **DO** go to **Inbucket** (local email catcher)

### The Solution

**Inbucket** is a local email testing tool that catches all emails sent by local Supabase.

#### Access Inbucket

**URL:** http://127.0.0.1:54324

```bash
# Quick open
open http://127.0.0.1:54324

# Or add to package.json
npm run db:inbucket  # (we'll add this)
```

## 🔐 How Local Auth Works

### 1. **Magic Link Flow (Local)**

```mermaid
User enters email → Supabase Auth → Inbucket (NOT real email!)
                                         ↓
                              View email at http://127.0.0.1:54324
                                         ↓
                              Click magic link → Logged in!
```

### 2. **Testing Magic Links**

#### Step 1: Request Magic Link

1. Go to http://localhost:3000/signin
2. Enter **any email** (doesn't need to be real!)
   - Try: `test@example.com`
   - Or: `your-email@test.local`

#### Step 2: Check Inbucket

1. Open http://127.0.0.1:54324
2. Click on the email address you used
3. Click on the email with subject: "Confirm your signup"
4. Click the magic link in the email

#### Step 3: You're Logged In!

The magic link redirects you back to your app, fully authenticated.

### 3. **OAuth (Google) - Local Limitations**

⚠️ **OAuth providers (Google, etc.) require production URLs** and won't work seamlessly with localhost without additional setup.

**For local testing, use:**

- ✅ **Magic links** (via Inbucket)
- ✅ **Email/password** (if you enable it)

## 📊 Local vs Production

| Feature            | Local                                    | Production             |
| ------------------ | ---------------------------------------- | ---------------------- |
| **Database**       | ✅ Local Supabase                        | ☁️ Supabase Cloud      |
| **Auth**           | ✅ Local Supabase Auth                   | ☁️ Supabase Auth       |
| **Magic Links**    | ✅ Via Inbucket (http://127.0.0.1:54324) | ✅ Via Real Email      |
| **OAuth (Google)** | ⚠️ Requires setup                        | ✅ Works               |
| **Email Service**  | ✅ Inbucket                              | ☁️ Your email provider |

## 🛠 Quick Setup

### Add Inbucket Command

Add to `package.json`:

```json
{
  "scripts": {
    "db:inbucket": "open http://127.0.0.1:54324"
  }
}
```

### Create Test Users

You can create users with **any email address** locally:

```bash
# These all work locally (emails caught by Inbucket):
test@example.com
admin@test.local
user1@demo.test
your-name@anything.fake
```

## 🧪 Testing Authentication

### Test Magic Link Login

```bash
# 1. Start your app
npm run dev

# 2. Go to signin page
open http://localhost:3000/signin

# 3. Enter test email
# Email: test@example.com

# 4. Click "Send Magic Link"
# You'll see: "Check your emails!"

# 5. Open Inbucket
open http://127.0.0.1:54324

# 6. Click on "test@example.com" in the list
# 7. Click the email that just arrived
# 8. Click the "Confirm your signup" link
# 9. You're logged in!
```

### Test With Different Emails

Try these to simulate different users:

```
admin@pub.test      → Restaurant admin
staff@pub.test      → Restaurant staff
customer@test.com   → Regular customer
manager@venue.test  → Venue manager
```

Each email will appear in Inbucket separately.

## 📧 Inbucket Features

### What You Can Do

1. **View All Emails** - See every email sent by your app
2. **Click Magic Links** - Test authentication flows
3. **Check Email Content** - Verify email templates
4. **Test Multiple Users** - Each email address is separate

### Inbucket UI

```
http://127.0.0.1:54324

┌─────────────────────────────────────┐
│ Inbucket - Local Email Testing     │
├─────────────────────────────────────┤
│ Mailboxes:                          │
│  📧 test@example.com (1 new)        │
│  📧 admin@test.local (0)            │
│  📧 customer@demo.test (2 new)      │
└─────────────────────────────────────┘

Click any mailbox → See emails → Click links
```

## 🔑 Creating Users for RLS Testing

Since your database has Row Level Security, you need users assigned to restaurants.

### Option 1: Use Seeded Owner ID

The seed data created a dummy owner:

```
User ID: 00000000-0000-0000-0000-000000000001
```

This user owns all 8 restaurants.

### Option 2: Create Real Test Users

1. **Sign up via magic link** (any email)
2. **Get the user ID** from Supabase Studio:
   - Open http://127.0.0.1:54323
   - Go to Authentication → Users
   - Copy the user ID

3. **Assign to restaurant** (in Studio SQL Editor):
   ```sql
   INSERT INTO restaurant_memberships (user_id, restaurant_id, role)
   VALUES (
     'your-user-id-here',
     '5746c074-3c20-4876-a9af-b63bb13a0772', -- The Queen Elizabeth Pub
     'owner'
   );
   ```

## 🎯 Common Scenarios

### "I don't see the magic link email"

✅ **Check Inbucket:** http://127.0.0.1:54324

- Emails go here, not your real inbox!

### "Magic link doesn't work"

1. Check the URL in the link
2. Should redirect to: `http://localhost:3000/api/auth/callback`
3. Make sure your app is running: `npm run dev`

### "I want to use my real email"

For local development, **you don't need to**:

- Use any fake email: `test@test.test`
- All emails go to Inbucket
- Faster than waiting for real emails!

### "How do I test with different users?"

1. Sign up with different emails in Inbucket
2. Each gets their own magic link
3. Switch between users by signing out/in

## 🚀 Production Considerations

When deploying to production:

### 1. **Switch to Production Supabase**

In `.env.local`:

```env
# Uncomment production, comment out local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

### 2. **Configure Real Email**

Production Supabase can send emails via:

- Supabase's built-in email (limited)
- SendGrid
- AWS SES
- Resend (you already have this configured!)

### 3. **Set Up OAuth**

Configure Google OAuth in Supabase dashboard with your production URLs.

## 📚 Resources

### Local Services

| Service             | URL                    | Purpose            |
| ------------------- | ---------------------- | ------------------ |
| **App**             | http://localhost:3000  | Your Next.js app   |
| **Supabase Studio** | http://127.0.0.1:54323 | Database UI        |
| **Supabase API**    | http://127.0.0.1:54321 | REST API           |
| **Inbucket**        | http://127.0.0.1:54324 | **📧 EMAIL INBOX** |

### Quick Commands

```bash
# Open Inbucket (check emails)
open http://127.0.0.1:54324

# Open Studio (manage users)
open http://127.0.0.1:54323

# Check all services
npm run db:status
```

## 🎉 TL;DR

**Q: Where are my magic link emails?**  
**A:** http://127.0.0.1:54324 (Inbucket)

**Q: Can I use any email?**  
**A:** Yes! Any email works locally (test@test.test, admin@fake.com, etc.)

**Q: Do I need a real email account?**  
**A:** No! Inbucket catches everything.

**Q: Is everything local?**  
**A:** Yes! Database, auth, emails - all local.

---

**Start testing auth:**

1. `npm run dev`
2. Go to http://localhost:3000/signin
3. Enter any email
4. Check http://127.0.0.1:54324 for the magic link!
