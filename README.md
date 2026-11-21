# Ziko Barbershop Platform

A complete barbershop booking platform built with React, Tailwind CSS, and Supabase. 100% backend and database live in Supabase with no custom server.

## Features

- **Public Website**: Homepage with services, barbers, gallery, reviews, hours, and booking
- **Booking System**: Service → Barber → Date → Time slot selection with guest/customer support
- **Customer Portal**: View and cancel bookings with real-time status updates
- **Admin Dashboard**: Complete shop management with analytics, appointments, add/edit services, barbers, etc.; Ziko can change his own email/password from **My account**
- **Barber Dashboard**: Accept/decline bookings, manage own prices, offered services, working hours, time off, and login credentials
- **Barber Accounts**: Ziko creates each barber login from Admin → Barbers; barbers sign in on the single staff login page and can change their email/password afterwards
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
4. Then run `supabase/migrations/20251122000000_barber_self_service.sql`. It adds per-barber prices/durations to `barber_services`, updates `get_available_slots` and `create_booking` to use them, and seeds a schedule when a new barber is added.
5. Then run `supabase/migrations/20251123000000_fix_booking_slots.sql`. It offers every active service to every active barber (fixing empty hours for services such as `Beard + Brushing`), auto-offers future services, and interprets working hours in `Africa/Tunis`.

### 3. Create Storage Bucket

1. Go to Storage in Supabase
2. Create a new bucket named `shop-media`
3. Make it public
4. The RLS policies are already included in the migration

### 4. Deploy Edge Functions

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Deploy the functions (JWT verification is disabled in `supabase/config.toml`):
   ```bash
   supabase functions deploy create-barber-account --no-verify-jwt
   supabase functions deploy send-booking-email --no-verify-jwt
   supabase functions deploy verify-turnstile --no-verify-jwt
   ```
5. Set the email and Turnstile secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set EMAIL_FROM="Ziko Barbershop <booking@yourdomain.com>"
   supabase secrets set TURNSTILE_SECRET_KEY=your_turnstile_secret_key
   ```
   The `EMAIL_FROM` domain must be verified in Resend. Dates in the emails use `Africa/Tunis` and the emails are written in French. Never put `TURNSTILE_SECRET_KEY` in the frontend or in `.env`.
6. Booking notifications are sent to the email on the barber's Supabase Auth account. Changing a barber's email in **Admin → Barbers** or in the barber's **My account** changes the recipient automatically. The `BARBER_EMAILS` map in `supabase/functions/send-booking-email/index.ts` is only a fallback if the account email cannot be resolved. For Ziko's bookings (his barber row has no linked profile), the function uses the admin account's email.

### Booking email flow

Create one Database Webhook in the Supabase dashboard:

- **Database → Webhooks → Create a new webhook**
- Name: `booking-emails`
- Table: `public.bookings`
- Events: **Insert** and **Update**
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-email`
- Method: POST (no auth header needed — `verify_jwt` is disabled)

How it behaves:

- **Insert** (new booking) → emails the selected barber at the address on his account (fallback: `BARBER_EMAILS`).
- **Update** where `status` changes to `accepted` or `denied` → emails the address entered in the booking form, with the result and the denial reason if any.

To test manually, call the function with a webhook-shaped body:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-email \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","record":{"barber_id":"BARBER_UUID","customer_email":"customer@example.com","guest_name":"John","guest_phone":"0612345678","service_name":"Classic Haircut","starts_at":"2026-11-25T10:00:00Z","price_at_booking":25,"status":"pending"}}'
```

### Turnstile booking check

- The public site key is `frontend/src/config/turnstile.js`; it is safe to ship with the frontend.
- Your production/localhost domains are already allowed in Cloudflare Turnstile.
- The secret key is stored only as the Supabase secret `TURNSTILE_SECRET_KEY` (see step 4).
- The visible checkbox appears only on the final booking step. The customer must tick it before **Confirm Booking** is enabled.
- On submit, the frontend calls `verify-turnstile`. Only when Cloudflare confirms the token does the app call `create_booking`. A failed or expired check clears the checkbox so the customer can tick it again.

### 5. Configure Authentication

1. Go to Authentication → Settings
2. **Email Auth**: Enable email provider, turn OFF "Confirm email" for instant sign-in
3. **Google Auth**: Go to Authentication → Providers → Google, enable it, and add your Google OAuth `client_id` and `client_secret` from Google Cloud Console. Add `<SITE_URL>/auth/v1/callback` to the Authorized Redirect URIs in Google Cloud Console (Supabase shows the exact callback URL on the provider page).
4. **Site URL**: Set to your frontend URL (e.g., `http://localhost:5173` for dev, or your deployed URL). The "Continue with Google" button on the sign-in page redirects back to this URL.

### 6. Create First Admin

1. Create Ziko's user in Supabase → **Authentication → Users → Add user** (there is no public sign-up page; customers book as guests)
2. Go to SQL Editor and run:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_AUTH_USER_UUID';
```
Replace `YOUR_AUTH_USER_UUID` with the actual user ID from Authentication → Users

### Creating barber accounts

1. As Ziko (admin), open **Admin → Barbers** and click **Add barber**.
2. Fill in the barber's name/bio and the **login email + password** you want him to use. The function creates the Supabase Auth user and links it to the barber profile.
3. Existing barbers can be edited the same way: use the **Edit** button to link a login or reset a password/email.
4. The barber signs in on the single `/login` page with the password Ziko gave him, or with **Continue with Google** using that exact same email. The app detects the role and opens `/barber` for him and `/admin` for Ziko.
5. In his dashboard he can:
   - see **Booking requests** and accept/decline only his own pending bookings (the customer email is sent automatically), then see accepted bookings under **Accepted appointments**,
   - choose which shop services he offers and set **his own price and duration** for each,
   - edit his weekly hours and add time off,
   - change his login email/password under **Account**.

Deploy `create-barber-account` (step 4 above) before using the Add barber form. The function checks that the caller is an admin before it uses the service role key.

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

- **No customer accounts** - Customers book as guests with their email; only Ziko and barbers have logins
- **Turnstile on the final booking step** - public site key in the frontend, secret key in Supabase, verified before `create_booking`
- **No service role key in frontend** - Only used in Edge Function
- **Email confirmation disabled** for instant sign-in as requested
- **Email notifications via Resend**: the barber is emailed on a new booking, and the customer is emailed when the booking is accepted or declined
- **Per-barber decisions**: each barber sees and accepts/declines only his own bookings; `decide_booking` also enforces this on the server
- **Per-barber pricing**: `create_booking` charges the price the barber set for that service; the shop price is used as the default
- **No Google Calendar integration**
- **No mock data or local storage for app data**
- **All business logic in Postgres functions** called via `supabase.rpc()`
- **RLS enabled on all tables**
- **Realtime enabled on bookings table**

## Default Login

Staff signs in once at `/login`; the app opens the correct dashboard automatically:
- `/login` - Single sign-in page for Ziko and barbers
- `/admin` - Admin Dashboard (admin role)
- `/barber` - Barber Dashboard (barber role)
- `/booking` - Book appointments (public)

## Support

For issues or questions, refer to the Supabase documentation.
