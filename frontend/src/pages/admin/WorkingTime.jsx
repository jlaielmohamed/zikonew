import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock, Calendar, XCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

// Postgres returns "09:00:00"; the time input and our comparisons use "09:00"
const hhmm = (t) => (t ? t.slice(0, 5) : '')
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

const emptySpecial = { date: '', type: 'closed', open: DEFAULT_OPEN, close: DEFAULT_CLOSE, reason: '' }

export default function WorkingTime() {
  const [shopHours, setShopHours] = useState([]) // last saved state
  const [draft, setDraft] = useState([])         // what the admin is editing
  const [specialDays, setSpecialDays] = useState([])
  const [form, setForm] = useState(emptySpecial)
  const [loading, setLoading] = useState(true)
  const [savingWeek, setSavingWeek] = useState(false)
  const [savingSpecial, setSavingSpecial] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [hoursRes, specialRes] = await Promise.all([
      supabase.from('shop_hours').select('*').order('weekday'),
      supabase.from('special_days').select('*').order('date')
    ])
    if (hoursRes.error || specialRes.error) {
      toast.error('Could not load working times')
    }
    const hours = (hoursRes.data || []).map((h) => ({
      ...h,
      open_time: hhmm(h.open_time),
      close_time: hhmm(h.close_time)
    }))
    setShopHours(hours)
    setDraft(hours)
    setSpecialDays(specialRes.data || [])
    setLoading(false)
  }

  /* ---------- Weekly schedule ---------- */

  const updateDraft = (weekday, changes) =>
    setDraft((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...changes } : h)))

  const toggleOpen = (weekday) => {
    const day = draft.find((h) => h.weekday === weekday)
    const opening = !day.is_open
    updateDraft(weekday, {
      is_open: opening,
      // a day that was closed may have no times yet, so give it sensible defaults
      open_time: day.open_time || DEFAULT_OPEN,
      close_time: day.close_time || DEFAULT_CLOSE
    })
  }

  const isChanged = (h) => {
    const saved = shopHours.find((s) => s.weekday === h.weekday)
    return (
      !saved ||
      saved.is_open !== h.is_open ||
      (h.is_open && (saved.open_time !== h.open_time || saved.close_time !== h.close_time))
    )
  }
  const hasChanges = draft.some(isChanged)

  const saveWeek = async () => {
    const changed = draft.filter(isChanged)
    for (const h of changed) {
      if (h.is_open && (!h.open_time || !h.close_time || h.open_time >= h.close_time)) {
        return toast.error(`${DAY_NAMES[h.weekday]}: closing time must be after opening time`)
      }
    }
    setSavingWeek(true)
    try {
      const rows = changed.map((h) => ({
        weekday: h.weekday,
        is_open: h.is_open,
        open_time: h.open_time || null,
        close_time: h.close_time || null
      }))
      const { error } = await supabase.from('shop_hours').upsert(rows, { onConflict: 'weekday' })
      if (error) throw error
      setShopHours(draft)
      toast.success('Weekly schedule saved')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingWeek(false)
    }
  }

  /* ---------- Closed days & special hours ---------- */

  const addSpecialDay = async () => {
    if (!form.date) return toast.error('Pick a date')
    if (form.date < todayStr()) return toast.error('That date is in the past')
    if (form.type === 'custom_hours') {
      if (!form.open || !form.close || form.open >= form.close) {
        return toast.error('Closing time must be after opening time')
      }
    }

    setSavingSpecial(true)
    try {
      const { error } = await supabase.from('special_days').insert({
        date: form.date,
        type: form.type,
        // empty strings are not valid for TIME columns, so closed days store null
        open_time: form.type === 'custom_hours' ? form.open : null,
        close_time: form.type === 'custom_hours' ? form.close : null,
        reason: form.reason.trim() || null
      })
      if (error) {
        if (error.code === '23505') {
          throw new Error('That date already has a closure or custom hours. Remove it first to change it.')
        }
        throw error
      }
      setForm(emptySpecial)
      await fetchData()
      toast.success(form.type === 'closed' ? 'Closed day added' : 'Custom hours added')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingSpecial(false)
    }
  }

  const deleteSpecialDay = async (id) => {
    if (!window.confirm('Remove this entry? The shop will follow its weekly schedule again on that date.')) return
    const { error } = await supabase.from('special_days').delete().eq('id', id)
    if (error) return toast.error(error.message)
    setSpecialDays((prev) => prev.filter((d) => d.id !== id))
    toast.success('Entry removed')
  }

  if (loading) return <div className="text-white">Loading...</div>

  const today = todayStr()
  const upcoming = specialDays.filter((d) => d.date >= today)
  const past = specialDays.filter((d) => d.date < today)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Clock className="h-8 w-8 text-gold-500 mr-3" />
        Working Time
      </h1>

      {/* Weekly schedule */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <CheckCircle className="h-5 w-5 text-gold-500 mr-2" />
              Weekly schedule
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Set the usual opening hours. A day marked Closed is closed every week.
            </p>
          </div>
          <button onClick={saveWeek} disabled={!hasChanges || savingWeek} className="btn-primary disabled:opacity-50">
            {savingWeek ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        <div className="space-y-3">
          {draft.map((h) => (
            <div
              key={h.weekday}
              className={`flex flex-wrap justify-between items-center p-4 bg-dark-700 rounded-lg gap-4 ${
                isChanged(h) ? 'ring-1 ring-gold-500' : ''
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-white font-medium w-24">{DAY_NAMES[h.weekday]}</span>
                <button
                  type="button"
                  onClick={() => toggleOpen(h.weekday)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    h.is_open ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {h.is_open ? 'Open' : 'Closed'}
                </button>
              </div>

              {h.is_open && (
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    className="input bg-dark-800 text-white text-sm p-1"
                    value={h.open_time}
                    onChange={(e) => updateDraft(h.weekday, { open_time: e.target.value })}
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    className="input bg-dark-800 text-white text-sm p-1"
                    value={h.close_time}
                    onChange={(e) => updateDraft(h.weekday, { close_time: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Closed days & special hours */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-1 flex items-center">
          <Calendar className="h-5 w-5 text-gold-500 mr-2" />
          Closed days and special hours
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Close the shop on a specific date (a holiday, for example) or use different hours for that one day.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-800 p-4 rounded-lg space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input
                type="date"
                min={today}
                className="input w-full"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">What happens on this date</label>
              <select
                className="input w-full"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="closed">Shop is closed all day</option>
                <option value="custom_hours">Different opening hours</option>
              </select>
            </div>

            {form.type === 'custom_hours' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Opens</label>
                  <input
                    type="time"
                    className="input w-full"
                    value={form.open}
                    onChange={(e) => setForm({ ...form, open: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Closes</label>
                  <input
                    type="time"
                    className="input w-full"
                    value={form.close}
                    onChange={(e) => setForm({ ...form, close: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Reason (optional)</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Public holiday"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <button onClick={addSpecialDay} className="btn-primary w-full" disabled={savingSpecial}>
              {savingSpecial ? 'Saving...' : form.type === 'closed' ? 'Add closed day' : 'Add custom hours'}
            </button>
          </div>

          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-gray-500 text-center py-8">No upcoming closed days or special hours</p>
            )}
            {upcoming.map((day) => (
              <SpecialDayRow key={day.id} day={day} onDelete={deleteSpecialDay} />
            ))}

            {past.length > 0 && (
              <details className="pt-2">
                <summary className="text-sm text-gray-400 cursor-pointer">Past entries ({past.length})</summary>
                <div className="space-y-3 mt-3 opacity-60">
                  {[...past].reverse().map((day) => (
                    <SpecialDayRow key={day.id} day={day} onDelete={deleteSpecialDay} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SpecialDayRow({ day, onDelete }) {
  return (
    <div className="flex justify-between items-center p-3 bg-dark-700 rounded-lg">
      <div>
        <p className="text-white font-medium">{format(parseISO(day.date), 'PPPP')}</p>
        <p className="text-xs text-gray-400">
          {day.type === 'closed' ? 'Closed all day' : `Open ${hhmm(day.open_time)} to ${hhmm(day.close_time)}`}
          {day.reason && `, ${day.reason}`}
        </p>
      </div>
      <button
        onClick={() => onDelete(day.id)}
        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
        aria-label="Remove entry"
      >
        <XCircle className="h-5 w-5" />
      </button>
    </div>
  )
}
