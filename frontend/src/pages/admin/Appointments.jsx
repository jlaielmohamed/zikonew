import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Check, X, Edit, Calendar } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

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

  if (loading) {
    return <div className="text-white">{t('a.loading')}</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">{t('a.menu.appointments')}</h1>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input"
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
          className="input flex-1"
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
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
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    booking.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                    booking.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    booking.status === 'denied' ? 'bg-red-500/10 text-red-500' :
                    booking.status === 'cancelled' ? 'bg-gray-500/10 text-gray-500' :
                    booking.status === 'completed' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-red-600/10 text-red-600'
                  }`}>
                    {t(`status.${booking.status}`)}
                  </span>
                </td>
                <td className="py-3 text-gold-500">{formatPrice(booking.price_at_booking)}</td>
                <td className="py-3">
                  <div className="flex space-x-2">
                    {booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleDecide(booking.id, 'accept')}
                          className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                          title={t('a.ap.accept')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDecide(booking.id, 'deny')}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          title={t('a.ap.deny')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {booking.status === 'accepted' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        >
                          {t('a.ap.complete')}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'no_show')}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                        >
                          {t('a.ap.noShow')}
                        </button>
                      </>
                    )}
                    {(booking.status === 'pending' || booking.status === 'accepted') && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                      >
                        {t('a.ap.cancel')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
