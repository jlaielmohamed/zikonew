-- Ziko Barbershop - fix empty booking hours
-- Run this AFTER 20251122000000_barber_self_service.sql.
-- 1) Offers every active service to every active barber (fixes Beard + Brushing).
-- 2) Auto-offers future services to barbers.
-- 3) Interprets working hours in Africa/Tunis instead of UTC.

-- ============================================================
-- BARBER SERVICES: backfill missing active services
-- ============================================================
insert into public.barber_services (
  barber_id, service_id, custom_price, custom_duration_minutes, is_active
)
select b.id, s.id, s.price, s.duration_minutes, true
from public.barbers b
cross join public.services s
where b.is_active = true
  and s.is_active = true
  and not exists (
    select 1
    from public.barber_services bs
    where bs.barber_id = b.id
      and bs.service_id = s.id
  );

-- Repair rows created before the self-service migration.
update public.barber_services bs
set
  custom_price = s.price,
  custom_duration_minutes = s.duration_minutes
from public.services s
where bs.service_id = s.id
  and (bs.custom_price is null or bs.custom_duration_minutes is null);

-- ============================================================
-- New (or reactivated) services are offered to active barbers
-- ============================================================
create or replace function public.offer_service_to_barbers()
returns trigger as $$
begin
  insert into public.barber_services (
    barber_id, service_id, custom_price, custom_duration_minutes, is_active
  )
  select b.id, new.id, new.price, new.duration_minutes, true
  from public.barbers b
  where b.is_active = true
    and not exists (
      select 1
      from public.barber_services bs
      where bs.barber_id = b.id
        and bs.service_id = new.id
    );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists offer_service_to_barbers on public.services;
create trigger offer_service_to_barbers
after insert or update of is_active on public.services
for each row when (new.is_active = true)
execute function public.offer_service_to_barbers();

-- ============================================================
-- AVAILABLE SLOTS: use Africa/Tunis for all local wall-clock times
-- ============================================================
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
        v_day_start := (p_date + v_special.open_time) AT TIME ZONE 'Africa/Tunis';
        v_day_end := (p_date + v_special.close_time) AT TIME ZONE 'Africa/Tunis';
      END IF;
    END IF;

    IF v_special IS NULL OR v_special.type != 'custom_hours' THEN
      SELECT * INTO v_shop_hour FROM shop_hours WHERE weekday = EXTRACT(DOW FROM p_date);
      IF v_shop_hour IS NULL OR v_shop_hour.is_open = FALSE OR v_shop_hour.open_time IS NULL OR v_shop_hour.close_time IS NULL THEN
        CONTINUE;
      END IF;
      v_day_start := (p_date + v_shop_hour.open_time) AT TIME ZONE 'Africa/Tunis';
      v_day_end := (p_date + v_shop_hour.close_time) AT TIME ZONE 'Africa/Tunis';
    END IF;

    SELECT * INTO v_working FROM working_hours WHERE working_hours.barber_id = v_barber.id AND weekday = EXTRACT(DOW FROM p_date);
    IF v_working IS NOT NULL AND v_working.is_working = FALSE THEN
      CONTINUE;
    END IF;
    IF v_working IS NOT NULL AND v_working.is_working = TRUE AND v_working.start_time IS NOT NULL AND v_working.end_time IS NOT NULL THEN
      v_day_start := GREATEST(v_day_start, (p_date + v_working.start_time) AT TIME ZONE 'Africa/Tunis');
      v_day_end := LEAST(v_day_end, (p_date + v_working.end_time) AT TIME ZONE 'Africa/Tunis');
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
