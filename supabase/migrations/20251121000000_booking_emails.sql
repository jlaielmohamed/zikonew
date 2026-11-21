-- Ziko Barbershop - fields needed by the booking email webhook
-- Run this AFTER the base migration (20251028000000_init_ziko*.sql).
-- Then create a Database Webhook in the Supabase dashboard (see README).

-- ============================================================
-- BOOKINGS: fields included in the webhook payload
-- ============================================================
alter table public.bookings add column if not exists customer_email text;
alter table public.bookings add column if not exists barber_name text;
alter table public.bookings add column if not exists service_name text;

-- Backfill existing bookings.
update public.bookings b
set
  customer_email = coalesce(b.customer_email, (select email from auth.users where id = b.customer_id)),
  barber_name = coalesce(b.barber_name, (select display_name from public.barbers where id = b.barber_id)),
  service_name = coalesce(b.service_name, (select name from public.services where id = b.service_id));

-- ============================================================
-- CREATE_BOOKING: store the email from the booking form + names
-- ============================================================
drop function if exists public.create_booking(uuid, uuid, timestamptz, text, text, text);

create or replace function public.create_booking(
  p_barber_id UUID,
  p_service_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_service RECORD;
  v_barber_name TEXT;
  v_settings RECORD;
  v_booking_id UUID;
  v_ends_at TIMESTAMPTZ;
  v_status booking_status;
  v_customer_id UUID;
  v_email TEXT;
BEGIN
  v_customer_id := auth.uid();
  v_email := lower(btrim(coalesce(p_customer_email, '')));

  IF v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_customer_id AND is_blocked = TRUE) THEN
      RAISE EXCEPTION 'User is blocked';
    END IF;
  END IF;

  SELECT * INTO v_settings FROM shop_settings WHERE id = 1;
  IF NOT COALESCE(v_settings.is_open_for_booking, TRUE) THEN
    RAISE EXCEPTION 'Booking is currently paused';
  END IF;

  SELECT * INTO v_service FROM services WHERE id = p_service_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or inactive';
  END IF;

  SELECT display_name INTO v_barber_name FROM barbers WHERE id = p_barber_id;

  v_ends_at := p_starts_at + (v_service.duration_minutes || ' minutes')::INTERVAL;

  IF p_starts_at < NOW() + (COALESCE(v_settings.min_notice_hours, 2) || ' hours')::INTERVAL THEN
    RAISE EXCEPTION 'Booking does not meet minimum notice requirement';
  END IF;

  IF p_starts_at > NOW() + (COALESCE(v_settings.max_days_ahead, 30) || ' days')::INTERVAL THEN
    RAISE EXCEPTION 'Booking is too far in the future';
  END IF;

  IF v_customer_id IS NULL AND (p_guest_name IS NULL OR p_guest_phone IS NULL) THEN
    RAISE EXCEPTION 'Guest name and phone required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barber_id = p_barber_id
    AND status IN ('pending', 'accepted')
    AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;

  IF COALESCE(v_settings.auto_accept_bookings, FALSE) THEN
    v_status := 'accepted';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO bookings (
    customer_id, guest_name, guest_phone, customer_email, barber_id, barber_name,
    service_id, service_name, starts_at, ends_at, price_at_booking, status, notes
  )
  VALUES (
    v_customer_id, p_guest_name, p_guest_phone, v_email, p_barber_id, v_barber_name,
    p_service_id, v_service.name, p_starts_at, v_ends_at, v_service.price, v_status, p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
