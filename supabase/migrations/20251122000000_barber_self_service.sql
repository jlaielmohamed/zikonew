-- Ziko Barbershop - barber self-service
-- Run this AFTER 20251121000000_booking_emails.sql.
-- Gives each barber his own prices/durations, lets him offer shop services,
-- and seeds a working schedule when Ziko adds a new barber.

-- ============================================================
-- BARBER_SERVICES: per-barber price / duration / availability
-- ============================================================
alter table public.barber_services
  add column if not exists custom_price numeric(10,2),
  add column if not exists custom_duration_minutes integer,
  add column if not exists is_active boolean not null default true;

-- Existing rows fall back to the shop's defaults until the barber edits them.
update public.barber_services bs
set
  custom_price = coalesce(bs.custom_price, s.price),
  custom_duration_minutes = coalesce(bs.custom_duration_minutes, s.duration_minutes)
from public.services s
where s.id = bs.service_id;

drop policy if exists "Barbers can manage own services" on public.barber_services;
create policy "Barbers can manage own services" on public.barber_services
  for all using (barber_id = current_barber_id() or is_admin());

-- ============================================================
-- DEFAULTS FOR NEW BARBERS
-- ============================================================
create or replace function public.seed_barber_defaults()
returns trigger as $$
begin
  -- Weekly schedule based on the shop schedule.
  insert into public.working_hours (barber_id, weekday, is_working, start_time, end_time, break_start, break_end)
  select new.id, sh.weekday, sh.is_open, sh.open_time, sh.close_time, sh.break_start, sh.break_end
  from public.shop_hours sh
  where not exists (
    select 1 from public.working_hours wh
    where wh.barber_id = new.id and wh.weekday = sh.weekday
  );

  -- Fallback if shop_hours has not been filled in yet.
  insert into public.working_hours (barber_id, weekday, is_working, start_time, end_time)
  select new.id, d.weekday, d.weekday between 1 and 5, time '09:00', time '18:00'
  from (values (0), (1), (2), (3), (4), (5), (6)) as d(weekday)
  where not exists (
    select 1 from public.working_hours wh
    where wh.barber_id = new.id and wh.weekday = d.weekday
  );

  -- Offer all active shop services at the shop's default price/duration.
  insert into public.barber_services (barber_id, service_id, custom_price, custom_duration_minutes, is_active)
  select new.id, s.id, s.price, s.duration_minutes, true
  from public.services s
  where s.is_active = true
  and not exists (
    select 1 from public.barber_services bs
    where bs.barber_id = new.id and bs.service_id = s.id
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists seed_barber_defaults on public.barbers;
create trigger seed_barber_defaults
  after insert on public.barbers
  for each row execute function public.seed_barber_defaults();

-- ============================================================
-- AVAILABLE SLOTS: use the barber's own duration and only offered services
-- ============================================================
drop function if exists public.get_available_slots(uuid, uuid, date);

create or replace function public.get_available_slots(
  p_barber_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  barber_id UUID,
  barber_name TEXT,
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  slot_price NUMERIC(10,2),
  slot_duration_minutes INTEGER
) AS $$
DECLARE
  v_service_duration INTEGER;
  v_slot_price NUMERIC(10,2);
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
  SELECT * INTO v_settings FROM shop_settings WHERE id = 1;
  v_slot_interval := COALESCE(v_settings.slot_interval_minutes, 30);
  v_min_notice := COALESCE(v_settings.min_notice_hours, 2);
  v_max_days := COALESCE(v_settings.max_days_ahead, 30);

  IF p_date < CURRENT_DATE OR p_date > CURRENT_DATE + v_max_days THEN
    RETURN;
  END IF;

  FOR v_barber IN
    SELECT b.* FROM barbers b
    WHERE b.is_active = TRUE
    AND (p_barber_id IS NULL OR b.id = p_barber_id)
    AND (
      p_service_id IS NULL
      OR EXISTS (
        SELECT 1 FROM barber_services bs
        WHERE bs.barber_id = b.id
        AND bs.service_id = p_service_id
        AND bs.is_active = TRUE
      )
    )
  LOOP
    v_service_duration := 30;
    v_slot_price := NULL;

    IF p_service_id IS NOT NULL THEN
      SELECT
        COALESCE(bs.custom_duration_minutes, s.duration_minutes, 30),
        COALESCE(bs.custom_price, s.price)
      INTO v_service_duration, v_slot_price
      FROM services s
      LEFT JOIN barber_services bs
        ON bs.service_id = s.id
        AND bs.barber_id = v_barber.id
        AND bs.is_active = TRUE
      WHERE s.id = p_service_id;

      v_service_duration := COALESCE(v_service_duration, 30);
    END IF;

    SELECT * INTO v_special FROM special_days WHERE special_days.date = p_date;
    IF v_special IS NOT NULL THEN
      IF v_special.type = 'closed' THEN
        CONTINUE;
      ELSIF v_special.type = 'custom_hours' AND v_special.open_time IS NOT NULL AND v_special.close_time IS NOT NULL THEN
        v_day_start := (p_date + v_special.open_time) AT TIME ZONE 'UTC';
        v_day_end := (p_date + v_special.close_time) AT TIME ZONE 'UTC';
      END IF;
    END IF;

    IF v_special IS NULL OR v_special.type != 'custom_hours' THEN
      SELECT * INTO v_shop_hour FROM shop_hours WHERE weekday = EXTRACT(DOW FROM p_date);
      IF v_shop_hour IS NULL OR v_shop_hour.is_open = FALSE OR v_shop_hour.open_time IS NULL OR v_shop_hour.close_time IS NULL THEN
        CONTINUE;
      END IF;
      v_day_start := (p_date + v_shop_hour.open_time) AT TIME ZONE 'UTC';
      v_day_end := (p_date + v_shop_hour.close_time) AT TIME ZONE 'UTC';
    END IF;

    SELECT * INTO v_working FROM working_hours WHERE working_hours.barber_id = v_barber.id AND weekday = EXTRACT(DOW FROM p_date);
    IF v_working IS NOT NULL AND v_working.is_working = FALSE THEN
      CONTINUE;
    END IF;
    IF v_working IS NOT NULL AND v_working.is_working = TRUE AND v_working.start_time IS NOT NULL AND v_working.end_time IS NOT NULL THEN
      v_day_start := GREATEST(v_day_start, (p_date + v_working.start_time) AT TIME ZONE 'UTC');
      v_day_end := LEAST(v_day_end, (p_date + v_working.end_time) AT TIME ZONE 'UTC');
    END IF;

    v_current_slot := date_trunc('minute', v_day_start);
    WHILE v_current_slot + (v_service_duration || ' minutes')::INTERVAL <= v_day_end LOOP
      v_slot_end_time := v_current_slot + (v_service_duration || ' minutes')::INTERVAL;

      IF v_current_slot < NOW() + (v_min_notice || ' hours')::INTERVAL THEN
        v_current_slot := v_current_slot + (v_slot_interval || ' minutes')::INTERVAL;
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.barber_id = v_barber.id
        AND b.status IN ('pending', 'accepted')
        AND tstzrange(b.starts_at, b.ends_at) && tstzrange(v_current_slot, v_slot_end_time)
      ) AND NOT EXISTS (
        SELECT 1 FROM time_off t
        WHERE t.barber_id = v_barber.id
        AND tstzrange(t.starts_at, t.ends_at) && tstzrange(v_current_slot, v_slot_end_time)
      ) THEN
        barber_id := v_barber.id;
        barber_name := v_barber.display_name;
        slot_start := v_current_slot;
        slot_end := v_slot_end_time;
        slot_price := v_slot_price;
        slot_duration_minutes := v_service_duration;
        RETURN NEXT;
      END IF;

      v_current_slot := v_current_slot + (v_slot_interval || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CREATE_BOOKING: charge the barber's price and use his duration
-- ============================================================
drop function if exists public.create_booking(uuid, uuid, timestamptz, text, text, text, text);

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
  v_duration INTEGER;
  v_price NUMERIC(10,2);
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

  SELECT b.display_name, bs.custom_price, bs.custom_duration_minutes
  INTO v_barber_name, v_price, v_duration
  FROM barbers b
  LEFT JOIN barber_services bs
    ON bs.barber_id = b.id
    AND bs.service_id = p_service_id
    AND bs.is_active = TRUE
  WHERE b.id = p_barber_id AND b.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barber not found or inactive';
  END IF;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'This barber does not offer that service';
  END IF;

  v_duration := COALESCE(v_duration, v_service.duration_minutes);
  v_price := COALESCE(v_price, v_service.price);
  v_ends_at := p_starts_at + (v_duration || ' minutes')::INTERVAL;

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
    p_service_id, v_service.name, p_starts_at, v_ends_at, v_price, v_status, p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
