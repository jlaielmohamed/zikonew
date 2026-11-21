import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Clock, Calendar, Trash2 } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import { useLanguage } from '../../i18n/LanguageContext'

const DEFAULT_START = '09:00'
const DEFAULT_END = '18:00'

const hhmm = (value) => (value ? value.slice(0, 5) : '')
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

const defaultWeek = (barberId) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    barber_id: barberId,
    weekday,
    is_working: weekday !== 0,
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
  }))

export default function BarberWorkingTime({ barber }) {
  const { t, dateLocale } = useLanguage()
  const [savedWeek, setSavedWeek] = useState([])
  const [draft, setDraft] = useState([])
  const [timeOff, setTimeOff] = useState([])
  const [form, setForm] = useState({ date: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [savingWeek, setSavingWeek] = useState(false)
  const [savingOff, setSavingOff] = useState(false)

  useEffect(() => {
    fetchData()
  }, [barber.id])

  const fetchData = async () => {
    setLoading(true)
    const [hoursRes, offRes] = await Promise.all([
      supabase.from('working_hours').select('*').eq('barber_id', barber.id).order('weekday'),
      supabase.from('time_off').select('*').eq('barber_id', barber.id).order('starts_at'),
    ])

    if (hoursRes.error || offRes.error) {
      toast.error(hoursRes.error?.message || offRes.error?.message)
    }

    const fallback = defaultWeek(barber.id)
    const hours = fallback.map((day) => {
      const saved = (hoursRes.data || []).find((h) => h.weekday === day.weekday)
      return saved
        ? {
            ...saved,
            start_time: hhmm(saved.start_time) || DEFAULT_START,
            end_time: hhmm(saved.end_time) || DEFAULT_END,
          }
        : day
    })

    setSavedWeek(hours)
    setDraft(hours.map((h) => ({ ...h })))
    setTimeOff(offRes.data || [])
    setLoading(false)
  }

  const updateDraft = (weekday, changes) =>
    setDraft((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...changes } : h)))

  const changed = draft.filter((h) => {
    const saved = savedWeek.find((s) => s.weekday === h.weekday)
    return (
      !saved ||
      saved.is_working !== h.is_working ||
      (h.is_working && (saved.start_time !== h.start_time || saved.end_time !== h.end_time))
    )
  })

  const saveWeek = async () => {
    for (const h of changed) {
      if (h.is_working && (!h.start_time || !h.end_time || h.start_time >= h.end_time)) {
        return toast.error(t('b.wt.closeAfterOpen'))
      }
    }

    setSavingWeek(true)
    try {
      const rows = (changed.length > 0 ? changed : draft).map((h) => ({
        barber_id: barber.id,
        weekday: h.weekday,
        is_working: h.is_working,
        start_time: h.is_working ? h.start_time : null,
        end_time: h.is_working ? h.end_time : null,
      }))
      const { error } = await supabase
        .from('working_hours')
        .upsert(rows, { onConflict: 'barber_id,weekday' })
      if (error) throw error
      setSavedWeek(draft.map((h) => ({ ...h })))
      toast.success(t('b.wt.weekSaved'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingWeek(false)
    }
  }

  const addTimeOff = async () => {
    if (!form.date) return toast.error(t('b.wt.pickDate'))
    if (form.date < todayStr()) return toast.error(t('b.wt.pastDate'))

    const nextDay = format(addDays(parseISO(form.date), 1), 'yyyy-MM-dd')
    setSavingOff(true)
    try {
      const { error } = await supabase.from('time_off').insert({
        barber_id: barber.id,
        starts_at: `${form.date}T00:00:00Z`,
        ends_at: `${nextDay}T00:00:00Z`,
        reason: form.reason.trim() || null,
      })
      if (error) throw error
      setForm({ date: '', reason: '' })
      await fetchData()
      toast.success(t('b.wt.added'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingOff(false)
    }
  }

  const removeTimeOff = async (id) => {
    const { error } = await supabase.from('time_off').delete().eq('id', id)
    if (error) return toast.error(error.message)
    setTimeOff((prev) => prev.filter((item) => item.id !== id))
    toast.success(t('b.wt.removed'))
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  const today = todayStr()
  const upcoming = timeOff.filter((item) => item.starts_at.slice(0, 10) >= today)
  const past = timeOff.filter((item) => item.starts_at.slice(0, 10) < today)

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center">
        <Clock className="h-6 w-6 text-gold-500 mr-3" />
        {t('b.wt.title') || t('a.menu.workingTime')}
      </h2>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{t('b.wt.weekly')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('b.wt.weeklyHelp')}</p>
          </div>
          <button
            onClick={saveWeek}
            disabled={changed.length === 0 || savingWeek}
            className="btn-primary disabled:opacity-50"
          >
            {savingWeek ? t('b.wt.saving') : t('b.wt.saveChanges')}
          </button>
        </div>

        <div className="space-y-3">
          {draft.map((day) => (
            <div
              key={day.weekday}
              className={`flex flex-wrap justify-between items-center p-4 bg-dark-700 rounded-lg gap-4 ${
                changed.some((c) => c.weekday === day.weekday) ? 'ring-1 ring-gold-500' : ''
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-white font-medium w-24">{t(`day.${day.weekday}`)}</span>
                <button
                  type="button"
                  onClick={() => updateDraft(day.weekday, { is_working: !day.is_working })}
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    day.is_working ? 'bg-green-500 text-white' : 'bg-gray-600 text-white'
                  }`}
                >
                  {day.is_working ? t('b.wt.working') : t('b.wt.notWorking')}
                </button>
              </div>

              {day.is_working && (
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    className="input bg-dark-800 text-white text-sm p-1"
                    value={day.start_time}
                    onChange={(e) => updateDraft(day.weekday, { start_time: e.target.value })}
                  />
                  <span className="text-gray-400">{t('b.wt.to') || t('a.wt.to')}</span>
                  <input
                    type="time"
                    className="input bg-dark-800 text-white text-sm p-1"
                    value={day.end_time}
                    onChange={(e) => updateDraft(day.weekday, { end_time: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="text-xl font-semibold text-white mb-1 flex items-center">
          <Calendar className="h-5 w-5 text-gold-500 mr-2" />
          {t('b.wt.timeOff')}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{t('b.wt.timeOffHelp')}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-800 p-4 rounded-lg space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.wt.date')}</label>
              <input
                type="date"
                min={today}
                className="input w-full"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.wt.reason')}</label>
              <input
                type="text"
                className="input w-full"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <button onClick={addTimeOff} disabled={savingOff} className="btn-primary w-full">
              {savingOff ? t('b.wt.saving') : t('b.wt.add')}
            </button>
          </div>

          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="text-gray-500 text-center py-8">{t('b.wt.none')}</p>
            )}
            {upcoming.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-dark-700 rounded-lg">
                <div>
                  <p className="text-white font-medium">
                    {format(parseISO(item.starts_at), 'PPPP', { locale: dateLocale })}
                  </p>
                  {item.reason && <p className="text-xs text-gray-400">{item.reason}</p>}
                </div>
                <button
                  onClick={() => removeTimeOff(item.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                  aria-label={t('b.wt.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {past.length > 0 && (
              <details className="pt-2">
                <summary className="text-sm text-gray-400 cursor-pointer">{t('b.wt.past')} ({past.length})</summary>
                <div className="space-y-3 mt-3 opacity-60">
                  {[...past].reverse().map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-dark-700 rounded-lg">
                      <p className="text-white">
                        {format(parseISO(item.starts_at), 'PPPP', { locale: dateLocale })}
                      </p>
                      <button
                        onClick={() => removeTimeOff(item.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                        aria-label={t('b.wt.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
