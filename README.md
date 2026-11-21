# Ziko Barbershop Platform

A complete barbershop booking platform built with React, Tailwind CSS, and Supabase. 100% backend and database live in Supabase with no custom server.

## Features

- **Public Website**: Homepage with services, barbers, gallery, reviews, hours, and booking
- **Booking System**: Service → Barber → Date → Time slot selection with guest/customer support
- **Customer Portal**: View and cancel bookings with real-time status updates
- **Admin Dashboard**: Complete shop management with analytics, appointments, services, barbers, etc.
- **Barber Dashboard**: Manage own schedule, mark appointments complete/no-show
- **Real-time Updates**: Live booking notifications and status changes
- **Role-based Access**: Customer, Barber, and Admin roles

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend/DB**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Deployment**: Netlify, Vercel, or Render Static

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Save your project URL and anon key

### 2. Run Database Migration

1. Go to your Supabase project → SQL Editor
2. Copy the entire contents of `supabase/migrations/20251028000000_init_ziko.sql` and run it
3. Then run `supabase/migrations/20251121000000_booking_emails.sql`. It adds `customer_email`, `barber_name` and `service_name` to `bookings` and updates `create_booking`.

### 3. Create Storage Bucket

1. Go to Storage in Supabase
2. Create a new bucket named `shop-media`
3. Make it public
4. The RLS policies are already included in the migration

### 4. Deploy Edge Functions

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Deploy both functions (JWT verification is disabled in `supabase/config.toml`):
   ```bash
   supabase functions deploy create-barber-account --no-verify-jwt
   supabase functions deploy send-booking-email --no-verify-jwt
   ```
5. Set the email secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set EMAIL_FROM="Ziko Barbershop <booking@yourdomain.com>"
   ```
   The `EMAIL_FROM` domain must be verified in Resend. Dates in the emails use `Africa/Tunis` and the emails are written in French.
6. The barber emails are already set in `supabase/functions/send-booking-email/index.ts` (Ziko → mohamedjlaiel.pro@gmail.com, Yassine → mohamedjlaiel5000@gmail.com). Routing uses the barber's name; add UUID keys to `BARBER_EMAILS` if you prefer strict ID-based routing.

### Booking email flow

Create one Database Webhook in the Supabase dashboard:

- **Database → Webhooks → Create a new webhook**
- Name: `booking-emails`
- Table: `public.bookings`
- Events: **Insert** and **Update**
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-email`
- Method: POST (no auth header needed — `verify_jwt` is disabled)

How it behaves:

- **Insert** (new booking) → emails the selected barber from the `BARBER_EMAILS` map.
- **Update** where `status` changes to `accepted` or `denied` → emails the address entered in the booking form, with the result and the denial reason if any.

To test manually, call the function with a webhook-shaped body:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-email \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","record":{"barber_id":"BARBER_UUID","customer_email":"customer@example.com","guest_name":"John","guest_phone":"0612345678","service_name":"Classic Haircut","starts_at":"2026-11-25T10:00:00Z","price_at_booking":25,"status":"pending"}}'
```

### 5. Configure Authentication

1. Go to Authentication → Settings
2. **Email Auth**: Enable email provider, turn OFF "Confirm email" for instant sign-in
3. **Google Auth**: Go to Authentication → Providers → Google, enable it, and add your Google OAuth `client_id` and `client_secret` from Google Cloud Console. Add `<SITE_URL>/auth/v1/callback` to the Authorized Redirect URIs in Google Cloud Console (Supabase shows the exact callback URL on the provider page).
4. **Site URL**: Set to your frontend URL (e.g., `http://localhost:5173` for dev, or your deployed URL). The "Continue with Google" buttons on the sign-in and sign-up pages redirect back to this URL.

### 6. Create First Admin

1. Sign up a user through your app or Supabase Auth
2. Go to SQL Editor and run:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_AUTH_USER_UUID';
```
Replace `YOUR_AUTH_USER_UUID` with the actual user ID from Authentication → Users

### 7. Setup Frontend

1. Navigate to `frontend` directory:
```bash
cd frontend
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Add your Supabase credentials to `.env`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Deployment

### Netlify
1. Build command: `cd frontend && npm run build`
2. Publish directory: `frontend/dist`
3. Add environment variables in Netlify settings

### Vercel
1. Import the repository
2. Framework preset: Vite
3. Root directory: `frontend`
4. Add environment variables

### Render Static Site
1. Build command: `cd frontend && npm install && npm run build`
2. Publish directory: `frontend/dist`
3. Add environment variables

## Important Notes

- **No service role key in frontend** - Only used in Edge Function
- **Email confirmation disabled** for instant sign-in as requested
- **Email notifications via Resend**: the barber is emailed on a new booking, and the customer is emailed when the booking is accepted or declined
- **No Google Calendar integration**
- **No mock data or local storage for app data**
- **All business logic in Postgres functions** called via `supabase.rpc()`
- **RLS enabled on all tables**
- **Realtime enabled on bookings table**

## Default Login

After creating your admin account, you can login and access:
- `/admin` - Admin Dashboard
- `/barber` - Barber Dashboard (if linked)
- `/booking` - Book appointments
- `/my-bookings` - Customer bookings

## Support

For issues or questions, refer to the Supabase documentation.
