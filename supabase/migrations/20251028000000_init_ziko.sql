-- Ziko Barbershop Platform - Complete Supabase Migration
-- Run this entire file in the Supabase SQL Editor

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('customer', 'barber', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'denied', 'cancelled', 'completed', 'no_show');
CREATE TYPE special_day_type AS ENUM ('closed', 'custom_hours');

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SHOP SETTINGS (single row)
-- ============================================
CREATE TABLE shop_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  shop_name TEXT NOT NULL DEFAULT 'Ziko Barbershop',
  logo_url TEXT,
  cover_url TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  phone TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  min_notice_hours INTEGER NOT NULL DEFAULT 2,
  max_days_ahead INTEGER NOT NULL DEFAULT 30,
  auto_accept_bookings BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_window_hours INTEGER NOT NULL DEFAULT 2,
  is_open_for_booking BOOLEAN NOT NULL DEFAULT TRUE,
  announcement_text TEXT,
  CONSTRAINT shop_settings_single_row CHECK (id = 1)
);

-- ============================================
-- BARBERS
-- ============================================
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  specialties TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SERVICES
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BARBER_SERVICES (many-to-many)
-- ============================================
CREATE TABLE barber_services (
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);

-- ============================================
-- SHOP HOURS (weekly schedule)
-- ============================================
CREATE TABLE shop_hours (
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  break_start TIME,
  break_end TIME,
  PRIMARY KEY (weekday)
);

-- ============================================
-- WORKING HOURS (per barber)
-- ============================================
CREATE TABLE working_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  break_start TIME,
  break_end TIME,
  UNIQUE(barber_id, weekday)
);

-- ============================================
-- SPECIAL DAYS
-- ============================================
CREATE TABLE special_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  type special_day_type NOT NULL,
  open_time TIME,
  close_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TIME OFF
-- ============================================
CREATE TABLE time_off (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_valid_range CHECK (ends_at > starts_at)
);

-- ============================================
-- BOOKINGS
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  price_at_booking NUMERIC(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  denial_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT bookings_guest_or_customer CHECK (customer_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_phone IS NOT NULL)),
  CONSTRAINT bookings_valid_times CHECK (ends_at > starts_at)
);

-- Exclusion constraint to prevent double booking for pending/accepted
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (status IN ('pending', 'accepted'));

-- ============================================
-- GALLERY
-- ============================================
CREATE TABLE gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CUSTOMER NOTES (admin only)
-- ============================================
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bookings_barber_id ON bookings(barber_id);
CREATE INDEX idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_working_hours_barber_id ON working_hours(barber_id);
CREATE INDEX idx_time_off_barber_id ON time_off(barber_id);
CREATE INDEX idx_barber_services_barber_id ON barber_services(barber_id);
CREATE INDEX idx_barber_services_service_id ON barber_services(service_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_blocked = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_barber_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM barbers
    WHERE profile_id = auth.uid() AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON barbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BUSINESS LOGIC FUNCTIONS
-- ============================================

-- Get available slots
CREATE OR REPLACE FUNCTION get_available_slots(
  p_barber_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  barber_id UUID,
  barber_name TEXT,
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ
) AS $$
DECLARE
  v_service_duration INTEGER;
  v_settings RECORD;
  v_slot_interval INTEGER;
  v_min_notice INTEGER;
  v_max_days INTEGER;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_current_slot TIMESTAMPTZ;
  v_slot_end_time TIMESTAMPTZ;
  v_barber RECORD;
  v_working RECORD;
  v_shop_hour RECORD;
  v_special RECORD;
BEGIN
  -- Get service duration
  IF p_service_id IS NOT NULL THEN
    SELECT duration_minutes INTO v_service_duration FROM services WHERE id = p_service_id;
  ELSE
    v_service_duration := 30; -- default
  END IF;

  -- Get settings
  SELECT * INTO v_settings FROM shop_settings WHERE id = 1;
  v_slot_interval := COALESCE(v_settings.slot_interval_minutes, 30);
  v_min_notice := COALESCE(v_settings.min_notice_hours, 2);
  v_max_days := COALESCE(v_settings.max_days_ahead, 30);

  -- Check if date is too far in future or too soon
  IF p_date < CURRENT_DATE THEN
    RETURN;
  END IF;
  IF p_date > CURRENT_DATE + v_max_days THEN
    RETURN;
  END IF;

  -- Get barbers to check
  FOR v_barber IN 
    SELECT b.* FROM barbers b
    WHERE b.is_active = TRUE
    AND (p_barber_id IS NULL OR b.id = p_barber_id)
    AND (p_service_id IS NULL OR EXISTS (SELECT 1 FROM barber_services bs WHERE bs.barber_id = b.id AND bs.service_id = p_service_id))
  LOOP
    -- Check special day
    SELECT * INTO v_special FROM special_days WHERE special_days.date = p_date;
    IF v_special IS NOT NULL THEN
      IF v_special.type = 'closed' THEN
        CONTINUE;
      ELSIF v_special.type = 'custom_hours' AND v_special.open_time IS NOT NULL AND v_special.close_time IS NOT NULL THEN
        v_day_start := (p_date + v_special.open_time) AT TIME ZONE 'UTC';
        v_day_end := (p_date + v_special.close_time) AT TIME ZONE 'UTC';
      END IF;
    END IF;

    -- Check shop hours if no special day override
    IF v_special IS NULL OR v_special.type != 'custom_hours' THEN
      SELECT * INTO v_shop_hour FROM shop_hours WHERE weekday = EXTRACT(DOW FROM p_date);
      IF v_shop_hour IS NULL OR v_shop_hour.is_open = FALSE OR v_shop_hour.open_time IS NULL OR v_shop_hour.close_time IS NULL THEN
        CONTINUE;
      END IF;
      v_day_start := (p_date + v_shop_hour.open_time) AT TIME ZONE 'UTC';
      v_day_end := (p_date + v_shop_hour.close_time) AT TIME ZONE 'UTC';
    END IF;

    -- Check barber working hours
    SELECT * INTO v_working FROM working_hours WHERE working_hours.barber_id = v_barber.id AND weekday = EXTRACT(DOW FROM p_date);
    IF v_working IS NOT NULL AND v_working.is_working = FALSE THEN
      CONTINUE;
    END IF;
    IF v_working IS NOT NULL AND v_working.is_working = TRUE AND v_working.start_time IS NOT NULL AND v_working.end_time IS NOT NULL THEN
      -- Use barber's working hours (intersect with shop hours conceptually)
      v_day_start := GREATEST(v_day_start, (p_date + v_working.start_time) AT TIME ZONE 'UTC');
      v_day_end := LEAST(v_day_end, (p_date + v_working.end_time) AT TIME ZONE 'UTC');
    END IF;

    -- Generate slots
    v_current_slot := date_trunc('minute', v_day_start);
    -- Align to interval
    WHILE v_current_slot + (v_service_duration || ' minutes')::INTERVAL <= v_day_end LOOP
      v_slot_end_time := v_current_slot + (v_service_duration || ' minutes')::INTERVAL;
      
      -- Check min notice
      IF v_current_slot < NOW() + (v_min_notice || ' hours')::INTERVAL THEN
        v_current_slot := v_current_slot + (v_slot_interval || ' minutes')::INTERVAL;
        CONTINUE;
      END IF;

      -- Check if slot conflicts with existing bookings
      IF NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.barber_id = v_barber.id
        AND b.status IN ('pending', 'accepted')
        AND tstzrange(b.starts_at, b.ends_at) && tstzrange(v_current_slot, v_slot_end_time)
      ) THEN
        -- Check time off
        IF NOT EXISTS (
          SELECT 1 FROM time_off t
          WHERE t.barber_id = v_barber.id
          AND tstzrange(t.starts_at, t.ends_at) && tstzrange(v_current_slot, v_slot_end_time)
        ) THEN
          -- Check barber breaks
          IF v_working IS NOT NULL AND v_working.break_start IS NOT NULL AND v_working.break_end IS NOT NULL THEN
            IF NOT (v_current_slot < (p_date + v_working.break_end) AT TIME ZONE 'UTC' AND v_slot_end_time > (p_date + v_working.break_start) AT TIME ZONE 'UTC') THEN
              barber_id := v_barber.id;
              barber_name := v_barber.display_name;
              slot_start := v_current_slot;
              slot_end := v_slot_end_time;
              RETURN NEXT;
            END IF;
          ELSIF v_shop_hour IS NOT NULL AND v_shop_hour.break_start IS NOT NULL AND v_shop_hour.break_end IS NOT NULL THEN
            IF NOT (v_current_slot < (p_date + v_shop_hour.break_end) AT TIME ZONE 'UTC' AND v_slot_end_time > (p_date + v_shop_hour.break_start) AT TIME ZONE 'UTC') THEN
              barber_id := v_barber.id;
              barber_name := v_barber.display_name;
              slot_start := v_current_slot;
              slot_end := v_slot_end_time;
              RETURN NEXT;
            END IF;
          ELSE
            barber_id := v_barber.id;
            barber_name := v_barber.display_name;
            slot_start := v_current_slot;
            slot_end := v_slot_end_time;
            RETURN NEXT;
          END IF;
        END IF;
      END IF;

      v_current_slot := v_current_slot + (v_slot_interval || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create booking
CREATE OR REPLACE FUNCTION create_booking(
  p_barber_id UUID,
  p_service_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_service RECORD;
  v_settings RECORD;
  v_booking_id UUID;
  v_ends_at TIMESTAMPTZ;
  v_status booking_status;
  v_customer_id UUID;
BEGIN
  v_customer_id := auth.uid();

  -- Check if user is blocked
  IF v_customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_customer_id AND is_blocked = TRUE) THEN
      RAISE EXCEPTION 'User is blocked';
    END IF;
  END IF;

  -- Get settings
  SELECT * INTO v_settings FROM shop_settings WHERE id = 1;
  IF NOT v_settings.is_open_for_booking THEN
    RAISE EXCEPTION 'Booking is currently paused';
  END IF;

  -- Get service
  SELECT * INTO v_service FROM services WHERE id = p_service_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or inactive';
  END IF;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;

  -- Check min notice
  IF p_starts_at < NOW() + (v_settings.min_notice_hours || ' hours')::INTERVAL THEN
    RAISE EXCEPTION 'Booking does not meet minimum notice requirement';
  END IF;

  -- Check max days ahead
  IF p_starts_at > NOW() + (v_settings.max_days_ahead || ' days')::INTERVAL THEN
    RAISE EXCEPTION 'Booking is too far in the future';
  END IF;

  -- Validate guest or customer
  IF v_customer_id IS NULL AND (p_guest_name IS NULL OR p_guest_phone IS NULL) THEN
    RAISE EXCEPTION 'Guest name and phone required';
  END IF;

  -- Check slot availability
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barber_id = p_barber_id
    AND status IN ('pending', 'accepted')
    AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;

  -- Determine status
  IF v_settings.auto_accept_bookings THEN
    v_status := 'accepted';
  ELSE
    v_status := 'pending';
  END IF;

  -- Create booking
  INSERT INTO bookings (customer_id, guest_name, guest_phone, barber_id, service_id, starts_at, ends_at, price_at_booking, status, notes)
  VALUES (v_customer_id, p_guest_name, p_guest_phone, p_barber_id, p_service_id, p_starts_at, v_ends_at, v_service.price, v_status, p_notes)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decide booking (accept/deny)
CREATE OR REPLACE FUNCTION decide_booking(
  booking_id UUID,
  decision TEXT,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking RECORD;
  v_barber_id UUID;
BEGIN
  -- Check permissions
  IF NOT is_admin() THEN
    v_barber_id := current_barber_id();
    IF v_barber_id IS NULL THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    -- Check if this barber is assigned to the booking
    SELECT * INTO v_booking FROM bookings WHERE id = booking_id AND barber_id = v_barber_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSE
    SELECT * INTO v_booking FROM bookings WHERE id = booking_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking not found';
    END IF;
  END IF;

  IF v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending bookings can be decided';
  END IF;

  IF decision = 'accept' THEN
    UPDATE bookings SET status = 'accepted', decided_at = NOW() WHERE id = booking_id;
    RETURN TRUE;
  ELSIF decision = 'deny' THEN
    UPDATE bookings SET status = 'denied', decided_at = NOW(), denial_reason = reason WHERE id = booking_id;
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Invalid decision';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel booking
CREATE OR REPLACE FUNCTION cancel_booking(booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking RECORD;
  v_settings RECORD;
  v_barber_id UUID;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT * INTO v_settings FROM shop_settings WHERE id = 1;

  -- Admin can always cancel
  IF is_admin() THEN
    UPDATE bookings SET status = 'cancelled' WHERE id = booking_id;
    RETURN TRUE;
  END IF;

  -- Barber can cancel their own bookings?
  v_barber_id := current_barber_id();
  IF v_barber_id IS NOT NULL AND v_booking.barber_id = v_barber_id THEN
    UPDATE bookings SET status = 'cancelled' WHERE id = booking_id;
    RETURN TRUE;
  END IF;

  -- Customer can cancel only their own booking within cancellation window
  IF v_booking.customer_id IS NOT NULL AND v_booking.customer_id = auth.uid() THEN
    IF v_booking.status IN ('completed', 'cancelled', 'denied', 'no_show') THEN
      RAISE EXCEPTION 'Cannot cancel this booking';
    END IF;
    -- Check cancellation window
    IF v_booking.starts_at < NOW() + (v_settings.cancellation_window_hours || ' hours')::INTERVAL THEN
      RAISE EXCEPTION 'Past cancellation window';
    END IF;
    UPDATE bookings SET status = 'cancelled' WHERE id = booking_id;
    RETURN TRUE;
  END IF;

  RAISE EXCEPTION 'Not authorized to cancel this booking';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin stats
CREATE OR REPLACE FUNCTION admin_stats(
  from_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  to_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'revenue', COALESCE((
      SELECT SUM(price_at_booking)
      FROM bookings
      WHERE status IN ('completed', 'accepted')
      AND created_at::DATE BETWEEN from_date AND to_date
    ), 0),
    'bookings_by_status', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM bookings
        WHERE created_at::DATE BETWEEN from_date AND to_date
        GROUP BY status
      ) s
    ),
    'top_services', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT sv.name, COUNT(*) as count, SUM(b.price_at_booking) as revenue
        FROM bookings b
        JOIN services sv ON sv.id = b.service_id
        WHERE b.created_at::DATE BETWEEN from_date AND to_date
        AND b.status IN ('completed', 'accepted')
        GROUP BY sv.id, sv.name
        ORDER BY count DESC
        LIMIT 10
      ) t
    ),
    'busiest_barbers', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT br.display_name, COUNT(*) as count, SUM(b.price_at_booking) as revenue
        FROM bookings b
        JOIN barbers br ON br.id = b.barber_id
        WHERE b.created_at::DATE BETWEEN from_date AND to_date
        AND b.status IN ('completed', 'accepted')
        GROUP BY br.id, br.display_name
        ORDER BY count DESC
        LIMIT 10
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (is_admin());

-- Shop settings - public read
CREATE POLICY "Public can read shop settings" ON shop_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage shop settings" ON shop_settings
  FOR ALL USING (is_admin());

-- Barbers - public read active
CREATE POLICY "Public can read active barbers" ON barbers
  FOR SELECT USING (is_active = true OR is_admin() OR profile_id = auth.uid());
CREATE POLICY "Admins can manage barbers" ON barbers
  FOR ALL USING (is_admin());

-- Services - public read active
CREATE POLICY "Public can read active services" ON services
  FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "Admins can manage services" ON services
  FOR ALL USING (is_admin());

-- Barber services
CREATE POLICY "Public can read barber services" ON barber_services
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage barber services" ON barber_services
  FOR ALL USING (is_admin());

-- Shop hours - public read
CREATE POLICY "Public can read shop hours" ON shop_hours
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage shop hours" ON shop_hours
  FOR ALL USING (is_admin());

-- Working hours - barber can edit own, admin all, public read?
CREATE POLICY "Public can read working hours" ON working_hours
  FOR SELECT USING (true);
CREATE POLICY "Barbers can manage own working hours" ON working_hours
  FOR ALL USING (barber_id = current_barber_id() OR is_admin());
CREATE POLICY "Admins can manage all working hours" ON working_hours
  FOR ALL USING (is_admin());

-- Special days - public read
CREATE POLICY "Public can read special days" ON special_days
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage special days" ON special_days
  FOR ALL USING (is_admin());

-- Time off - barber can manage own
CREATE POLICY "Barbers can manage own time off" ON time_off
  FOR ALL USING (barber_id = current_barber_id() OR is_admin());
CREATE POLICY "Admins can manage all time off" ON time_off
  FOR ALL USING (is_admin());

-- Bookings
CREATE POLICY "Customers can read own bookings" ON bookings
  FOR SELECT USING (
    customer_id = auth.uid() OR 
    barber_id = current_barber_id() OR 
    is_admin()
  );
CREATE POLICY "Public can insert bookings via function only" ON bookings
  FOR INSERT WITH CHECK (false); -- Force use of create_booking function
CREATE POLICY "Admins and barbers can update bookings" ON bookings
  FOR UPDATE USING (barber_id = current_barber_id() OR is_admin());
CREATE POLICY "Admins can delete bookings" ON bookings
  FOR DELETE USING (is_admin());

-- Gallery - public read
CREATE POLICY "Public can read gallery" ON gallery
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage gallery" ON gallery
  FOR ALL USING (is_admin());

-- Reviews - public read visible
CREATE POLICY "Public can read visible reviews" ON reviews
  FOR SELECT USING (is_visible = true OR is_admin());
CREATE POLICY "Customers can create reviews for their bookings" ON reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Admins can manage reviews" ON reviews
  FOR ALL USING (is_admin());

-- Customer notes - admin only
CREATE POLICY "Admins can manage customer notes" ON customer_notes
  FOR ALL USING (is_admin());

-- ============================================
-- STORAGE
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-media', 'shop-media', true);

CREATE POLICY "Public can view shop media" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-media');

CREATE POLICY "Admins can upload shop media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'shop-media' AND is_admin());

CREATE POLICY "Admins can update shop media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'shop-media' AND is_admin());

CREATE POLICY "Admins can delete shop media" ON storage.objects
  FOR DELETE USING (bucket_id = 'shop-media' AND is_admin());

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ============================================
-- SEED DATA
-- ============================================

-- Shop settings
INSERT INTO shop_settings (id, shop_name, description, address, city, phone, whatsapp, currency, slot_interval_minutes, min_notice_hours, max_days_ahead, auto_accept_bookings, cancellation_window_hours, is_open_for_booking, announcement_text)
VALUES (1, 'Ziko Barbershop', 'Premium barbershop experience with skilled professionals', '123 Main Street', 'New York', '+1234567890', '+1234567890', 'USD', 30, 2, 30, false, 2, true, 'Welcome to Ziko Barbershop - Book your appointment today!');

-- Shop hours (0=Sunday, 1=Monday, ..., 6=Saturday)
INSERT INTO shop_hours (weekday, is_open, open_time, close_time, break_start, break_end) VALUES
(0, false, null, null, null, null), -- Sunday closed
(1, true, '09:00', '18:00', '13:00', '14:00'), -- Monday
(2, true, '09:00', '18:00', '13:00', '14:00'), -- Tuesday
(3, true, '09:00', '18:00', '13:00', '14:00'), -- Wednesday
(4, true, '09:00', '18:00', '13:00', '14:00'), -- Thursday
(5, true, '09:00', '19:00', '13:00', '14:00'), -- Friday
(6, true, '09:00', '17:00', null, null); -- Saturday

-- Sample barbers
INSERT INTO barbers (id, display_name, bio, specialties, is_active, sort_order) VALUES
(uuid_generate_v4(), 'Mike Johnson', 'Master barber with 10 years of experience specializing in classic cuts and beard styling.', ARRAY['Classic Cuts', 'Beard Trim', 'Hot Towel Shave'], true, 1),
(uuid_generate_v4(), 'Sarah Chen', 'Expert in modern styles and creative cuts. Passionate about making clients look their best.', ARRAY['Modern Cuts', 'Fades', 'Color'], true, 2),
(uuid_generate_v4(), 'Carlos Rodriguez', 'Specialist in traditional barbering techniques with a modern twist.', ARRAY['Traditional Cuts', 'Straight Razor', 'Mustache Styling'], true, 3);

-- Sample services
INSERT INTO services (id, name, description, duration_minutes, price, category, is_active, sort_order) VALUES
(uuid_generate_v4(), 'Classic Haircut', 'Traditional haircut with scissors and clippers', 30, 25.00, 'Haircut', true, 1),
(uuid_generate_v4(), 'Modern Fade', 'Stylish fade cut with precision detailing', 35, 30.00, 'Haircut', true, 2),
(uuid_generate_v4(), 'Beard Trim', 'Shape and trim your beard to perfection', 20, 15.00, 'Beard', true, 3),
(uuid_generate_v4(), 'Hot Towel Shave', 'Luxurious straight razor shave with hot towel treatment', 40, 35.00, 'Shave', true, 4),
(uuid_generate_v4(), 'Haircut + Beard', 'Complete grooming package - haircut and beard trim', 45, 38.00, 'Package', true, 5),
(uuid_generate_v4(), 'Kids Cut', 'Gentle haircut for children under 12', 25, 20.00, 'Haircut', true, 6);

-- Assign services to barbers
INSERT INTO barber_services (barber_id, service_id)
SELECT b.id, s.id FROM barbers b CROSS JOIN services s WHERE b.display_name = 'Mike Johnson';

INSERT INTO barber_services (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s 
WHERE b.display_name = 'Sarah Chen' AND s.name IN ('Classic Haircut', 'Modern Fade', 'Kids Cut');

INSERT INTO barber_services (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s 
WHERE b.display_name = 'Carlos Rodriguez' AND s.name IN ('Classic Haircut', 'Beard Trim', 'Hot Towel Shave', 'Haircut + Beard');

-- Working hours for barbers (copy shop hours)
INSERT INTO working_hours (barber_id, weekday, is_working, start_time, end_time, break_start, break_end)
SELECT b.id, sh.weekday, sh.is_open, sh.open_time, sh.close_time, sh.break_start, sh.break_end
FROM barbers b CROSS JOIN shop_hours sh;

-- Gallery
INSERT INTO gallery (image_url, caption, sort_order) VALUES
('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800', 'Our modern shop interior', 1),
('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', 'Professional haircut service', 2),
('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800', 'Precision beard trimming', 3);

-- ============================================
-- MAKE FIRST ADMIN
-- ============================================
-- After creating your first user account, run this with your user ID:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR-AUTH-USER-UUID';
-- Or replace below with your actual UUID and run separately
-- INSERT INTO profiles (id, full_name, role) VALUES ('00000000-0000-0000-0000-000000000000', 'Admin', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin';
