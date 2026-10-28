import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock, Calendar, XCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useLanguage } from '../../i18n/LanguageContext'

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

// Postgres returns "09:00:00"; the time input and our comparisons use "09:00"
const hhmm = (t) => (t ? t.slice(0, 5) : '')
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

const emptySpecial = { date: '', type: 'closed', open: DEFAULT_OPEN, close: DEFAULT_CLOSE, reason: '' }

export default function WorkingTime() {
  const { t, dateLocale } = useLanguage()
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
      toast.error(t('a.wt.loadError'))
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
        return toast.error(`${t(`day.${h.weekday}`)}: ${t('a.wt.closeAfterOpen')}`)
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
      toast.success(t('a.wt.weekSaved'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingWeek(false)
    }
  }

  /* ---------- Closed days & special hours ---------- */

  const addSpecialDay = async () => {
    if (!form.date) return toast.error(t('a.wt.pickDate'))
    if (form.date < todayStr()) return toast.error(t('a.wt.pastDate'))
    if (form.type === 'custom_hours') {
      if (!form.open || !form.close || form.open >= form.close) {
        return toast.error(t('a.wt.closeAfterOpen'))
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
          throw new Error(t('a.wt.duplicate'))
        }
        throw error
      }
      setForm(emptySpecial)
      await fetchData()
      toast.success(form.type === 'closed' ? t('a.wt.closedAdded') : t('a.wt.customAdded'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingSpecial(false)
    }
  }

  const deleteSpecialDay = async (id) => {
    if (!window.confirm(t('a.wt.confirmRemove'))) return
    const { error } = await supabase.from('special_days').delete().eq('id', id)
    if (error) return toast.error(error.message)
    setSpecialDays((prev) => prev.filter((d) => d.id !== id))
    toast.success(t('a.wt.removed'))
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  const today = todayStr()
  const upcoming = specialDays.filter((d) => d.date >= today)
  const past = specialDays.filter((d) => d.date < today)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Clock className="h-8 w-8 text-gold-500 mr-3" />
        {t('a.wt.title')}
      </h1>

      {/* Weekly schedule */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <CheckCircle className="h-5 w-5 text-gold-500 mr-2" />
              {t('a.wt.weekly')}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {t('a.wt.weeklyHelp')}
            </p>
          </div>
          <button onClick={saveWeek} disabled={!hasChanges || savingWeek} className="btn-primary disabled:opacity-50">
            {savingWeek ? t('a.wt.saving') : t('a.wt.saveChanges')}
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
                <span className="text-white font-medium w-24">{t(`day.${h.weekday}`)}</span>
                <button
                  type="button"
                  onClick={() => toggleOpen(h.weekday)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    h.is_open ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {h.is_open ? t('a.wt.open') : t('a.wt.closed')}
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
                  <span className="text-gray-400">{t('a.wt.to')}</span>
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
          {t('a.wt.specialTitle')}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {t('a.wt.specialHelp')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-800 p-4 rounded-lg space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('a.wt.date')}</label>
              <input
                type="date"
                min={today}
                className="input w-full"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('a.wt.whatHappens')}</label>
              <select
                className="input w-full"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="closed">{t('a.wt.optClosed')}</option>
                <option value="custom_hours">{t('a.wt.optCustom')}</option>
              </select>
            </div>

            {form.type === 'custom_hours' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('a.wt.opens')}</label>
                  <input
                    type="time"
                    className="input w-full"
                    value={form.open}
                    onChange={(e) => setForm({ ...form, open: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('a.wt.closes')}</label>
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
              <label className="block text-xs text-gray-400 mb-1">{t('a.wt.reason')}</label>
              <input
                type="text"
                className="input w-full"
                placeholder={t('a.wt.reasonPh')}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <button onClick={addSpecialDay} className="btn-primary w-full" disabled={savingSpecial}>
              {savingSpecial ? t('a.wt.saving') : form.type === 'closed' ? t('a.wt.addClosed') : t('a.wt.addCustom')}
            </button>
          </div>

          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-gray-500 text-center py-8">{t('a.wt.none')}</p>
            )}
            {upcoming.map((day) => (
              <SpecialDayRow key={day.id} day={day} onDelete={deleteSpecialDay} />
            ))}

            {past.length > 0 && (
              <details className="pt-2">
                <summary className="text-sm text-gray-400 cursor-pointer">{t('a.wt.past')} ({past.length})</summary>
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
  const { t, dateLocale } = useLanguage()
  return (
    <div className="flex justify-between items-center p-3 bg-dark-700 rounded-lg">
      <div>
        <p className="text-white font-medium">{format(parseISO(day.date), 'PPPP', { locale: dateLocale })}</p>
        <p className="text-xs text-gray-400">
          {day.type === 'closed' ? t('a.wt.closedAllDay') : `${t('a.wt.openFrom')} ${hhmm(day.open_time)} ${t('a.wt.to')} ${hhmm(day.close_time)}`}
          {day.reason && `, ${day.reason}`}
        </p>
      </div>
      <button
        onClick={() => onDelete(day.id)}
        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
        aria-label={t('a.wt.removeEntry')}
      >
        <XCircle className="h-5 w-5" />
      </button>
    </div>
  )
}
