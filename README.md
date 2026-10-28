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
2. Copy the entire contents of `supabase/migrations/20251028000000_init_ziko.sql`
3. Paste and run the SQL

### 3. Create Storage Bucket

1. Go to Storage in Supabase
2. Create a new bucket named `shop-media`
3. Make it public
4. The RLS policies are already included in the migration

### 4. Deploy Edge Function

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Deploy the function: `supabase functions deploy create-barber-account --no-verify-jwt`
5. Set environment variables in Supabase:
   - Go to Edge Functions → create-barber-account → Settings
   - Add secrets: `SUPABASE_SERVICE_ROLE_KEY` (from Settings → API)

### 5. Configure Authentication

1. Go to Authentication → Settings
2. **Email Auth**: Enable email provider, turn OFF "Confirm email" for instant sign-in
3. **Google Auth** (optional): Enable Google provider and add OAuth credentials
4. **Site URL**: Set to your frontend URL (e.g., `http://localhost:5173` for dev, or your deployed URL)

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
- **No email sending or Google Calendar integration**
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
