import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const statusClass = (status) => {
  if (status === 'accepted') return 'bg-green-500/10 text-green-500'
  if (status === 'pending') return 'bg-yellow-500/10 text-yellow-500'
  if (status === 'denied') return 'bg-red-500/10 text-red-500'
  if (status === 'cancelled') return 'bg-gray-500/10 text-gray-500'
  if (status === 'completed') return 'bg-blue-500/10 text-blue-500'
  return 'bg-red-600/10 text-red-600'
}

function StatusBadge({ status, t }) {
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs whitespace-nowrap ${statusClass(status)}`}>
      {t(`status.${status}`)}
    </span>
  )
}

function BookingActions({ booking, onDecide, onUpdateStatus, onCancel, t }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {booking.status === 'pending' && (
        <>
          <button
            onClick={() => onDecide(booking.id, 'accept')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-green-500 hover:bg-green-500/10"
            title={t('a.ap.accept')}
          >
            <Check className="h-4 w-4" /> {t('a.ap.accept')}
          </button>
          <button
            onClick={() => onDecide(booking.id, 'deny')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-500/10"
            title={t('a.ap.deny')}
          >
            <X className="h-4 w-4" /> {t('a.ap.deny')}
          </button>
        </>
      )}
      {booking.status === 'accepted' && (
        <>
          <button
            onClick={() => onUpdateStatus(booking.id, 'completed')}
            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            {t('a.ap.complete')}
          </button>
          <button
            onClick={() => onUpdateStatus(booking.id, 'no_show')}
            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
          >
            {t('a.ap.noShow')}
          </button>
        </>
      )}
      {(booking.status === 'pending' || booking.status === 'accepted') && (
        <button
          onClick={() => onCancel(booking.id)}
          className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
        >
          {t('a.ap.cancel')}
        </button>
      )}
    </div>
  )
}

export default function Appointments() {
  const { t, formatPrice, dateLocale } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchBookings()

    const subscription = supabase
      .channel('appointments')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services(name, price),
          barbers(display_name),
          profiles(full_name, phone)
        `)
        .order('starts_at', { ascending: false })

      if (error) throw error
      setBookings(data || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      toast.error(t('my.fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDecide = async (bookingId, decision) => {
    let reason = null
    if (decision === 'deny') {
      reason = prompt(t('a.ap.denyPrompt'))
    }

    try {
      const { error } = await supabase.rpc('decide_booking', {
        booking_id: bookingId,
        decision: decision,
        reason: reason
      })
      if (error) throw error
      toast.success(decision === 'accept' ? t('a.ap.accepted') : t('a.ap.denied'))
      fetchBookings()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleCancel = async (bookingId) => {
    if (!confirm(t('my.confirmCancel'))) return

    try {
      const { error } = await supabase.rpc('cancel_booking', { booking_id: bookingId })
      if (error) throw error
      toast.success(t('my.cancelled'))
      fetchBookings()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleUpdateStatus = async (bookingId, status) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
      if (error) throw error
      toast.success(t('a.ap.statusUpdated'))
      fetchBookings()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesFilter = filter === 'all' || booking.status === filter
    const matchesSearch = searchTerm === '' ||
      (booking.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (booking.guest_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (booking.guest_phone?.includes(searchTerm)) ||
      (booking.profiles?.phone?.includes(searchTerm))
    return matchesFilter && matchesSearch
  })

  const actionProps = {
    onDecide: handleDecide,
    onUpdateStatus: handleUpdateStatus,
    onCancel: handleCancel,
    t,
  }

  if (loading) {
    return <div className="text-white">{t('a.loading')}</div>
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">{t('a.menu.appointments')}</h1>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-full sm:w-auto"
        >
          <option value="all">{t('a.ap.allStatus')}</option>
          <option value="pending">{t('status.pending')}</option>
          <option value="accepted">{t('status.accepted')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="denied">{t('status.denied')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
          <option value="no_show">{t('status.no_show')}</option>
        </select>
        <input
          type="text"
          placeholder={t('a.ap.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full flex-1 min-w-0"
        />
      </div>

      {filteredBookings.length === 0 ? (
        <div className="card text-gray-400 text-center py-8">{t('a.ov.noData')}</div>
      ) : (
        <>
          {/* Table for tablets and desktop */}
          <div className="card hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 pb-3">{t('a.ap.customer')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.ap.service')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.ap.barber')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.ap.dateTime')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.status')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.price')}</th>
                  <th className="text-left text-gray-400 pb-3">{t('a.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-gray-700/50">
                    <td className="py-3">
                      <div>
                        <p className="text-white font-semibold">
                          {booking.profiles?.full_name || booking.guest_name}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {booking.profiles?.phone || booking.guest_phone}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 text-white">{booking.services?.name}</td>
                    <td className="py-3 text-white">{booking.barbers?.display_name}</td>
                    <td className="py-3">
                      <div>
                        <p className="text-white">{format(new Date(booking.starts_at), t('fmt.shortDate'), { locale: dateLocale })}</p>
                        <p className="text-gray-400 text-sm">{format(new Date(booking.starts_at), 'HH:mm')}</p>
                      </div>
                    </td>
                    <td className="py-3"><StatusBadge status={booking.status} t={t} /></td>
                    <td className="py-3 text-gold-500">{formatPrice(booking.price_at_booking)}</td>
                    <td className="py-3">
                      <BookingActions booking={booking} {...actionProps} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for phones */}
          <div className="md:hidden space-y-3">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold break-words">
                      {booking.profiles?.full_name || booking.guest_name}
                    </p>
                    <p className="text-gray-400 text-sm break-words">
                      {booking.profiles?.phone || booking.guest_phone}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} t={t} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs">{t('a.ap.service')}</p>
                    <p className="text-white break-words">{booking.services?.name}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs">{t('a.ap.barber')}</p>
                    <p className="text-white break-words">{booking.barbers?.display_name}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs">{t('a.ap.dateTime')}</p>
                    <p className="text-white">
                      {format(new Date(booking.starts_at), t('fmt.shortDate'), { locale: dateLocale })}
                      {' · '}{format(new Date(booking.starts_at), 'HH:mm')}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs">{t('a.price')}</p>
                    <p className="text-gold-500">{formatPrice(booking.price_at_booking)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <BookingActions booking={booking} {...actionProps} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
