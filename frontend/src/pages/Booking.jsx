import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

export default function Booking() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [services, setServices] = useState([])
  const [barbers, setBarbers] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [selectedBarber, setSelectedBarber] = useState(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [shopSettings, setShopSettings] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedService && selectedDate) {
      fetchSlots()
    }
  }, [selectedService, selectedBarber, selectedDate])

  const fetchData = async () => {
    const [servicesRes, barbersRes, settingsRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('barbers').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('shop_settings').select('*').single()
    ])
    if (servicesRes.data) setServices(servicesRes.data)
    if (barbersRes.data) setBarbers(barbersRes.data)
    if (settingsRes.data) setShopSettings(settingsRes.data)
  }

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_slots', {
        barber_id: selectedBarber?.id || null,
        service_id: selectedService.id,
        date: selectedDate
      })
      if (error) throw error
      setAvailableSlots(data || [])
    } catch (error) {
      console.error('Error fetching slots:', error)
      toast.error('Error fetching available slots')
    }
  }

  const handleBooking = async () => {
    if (!selectedSlot) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('create_booking', {
        p_barber_id: selectedSlot.barber_id,
        p_service_id: selectedService.id,
        p_starts_at: selectedSlot.slot_start,
        p_guest_name: user ? null : guestName,
        p_guest_phone: user ? null : guestPhone,
        p_notes: notes || null
      })
      
      if (error) throw error
      
      toast.success('Booking created successfully!')
      navigate('/my-bookings')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return selectedService
    if (step === 2) return true // barber optional (any available)
    if (step === 3) return selectedDate
    if (step === 4) return selectedSlot
    if (step === 5) return user || (guestName && guestPhone)
    return false
  }

  const dates = []
  for (let i = 0; i < (shopSettings?.max_days_ahead || 30); i++) {
    dates.push(format(addDays(new Date(), i), 'yyyy-MM-dd'))
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">Book Appointment</h1>
        
        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {[1,2,3,4,5].map((s) => (
            <div key={s} className={`flex-1 text-center ${s < step ? 'text-gold-500' : s === step ? 'text-white' : 'text-gray-600'}`}>
              <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${s < step ? 'bg-gold-500 text-black' : s === step ? 'bg-gold-500 text-black' : 'bg-gray-700'}`}>
                {s}
              </div>
              <span className="text-sm">
                {s === 1 && 'Service'}
                {s === 2 && 'Barber'}
                {s === 3 && 'Date'}
                {s === 4 && 'Time'}
                {s === 5 && 'Confirm'}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Service</h2>
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`p-4 border rounded cursor-pointer transition-colors ${
                      selectedService?.id === service.id 
                        ? 'border-gold-500 bg-dark-700' 
                        : 'border-gray-600 hover:border-gold-400'
                    }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{service.name}</h3>
                        <p className="text-gray-400 text-sm">{service.description}</p>
                        <p className="text-gold-500 text-sm mt-1">{service.duration_minutes} min</p>
                      </div>
                      <div className="text-gold-500 font-bold">
                        {shopSettings?.currency || '$'}{service.price}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Barber */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Barber (Optional)</h2>
              <div className="space-y-3">
                <div
                  onClick={() => setSelectedBarber(null)}
                  className={`p-4 border rounded cursor-pointer transition-colors ${
                    selectedBarber === null 
                      ? 'border-gold-500 bg-dark-700' 
                      : 'border-gray-600 hover:border-gold-400'
                  }`}
                >
                  <h3 className="font-semibold text-white">Any Available Barber</h3>
                  <p className="text-gray-400 text-sm">First available appointment</p>
                </div>
                {barbers.map((barber) => (
                  <div
                    key={barber.id}
                    onClick={() => setSelectedBarber(barber)}
                    className={`p-4 border rounded cursor-pointer transition-colors ${
                      selectedBarber?.id === barber.id 
                        ? 'border-gold-500 bg-dark-700' 
                        : 'border-gray-600 hover:border-gold-400'
                    }`}
                  >
                    <h3 className="font-semibold text-white">{barber.display_name}</h3>
                    <p className="text-gray-400 text-sm">{barber.bio}</p>
                    {barber.specialties && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {barber.specialties.map((s, idx) => (
                          <span key={idx} className="bg-dark-600 text-gold-500 px-2 py-1 rounded text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Select Date */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Date</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {dates.slice(0, 16).map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 border rounded text-center transition-colors ${
                      selectedDate === date
                        ? 'border-gold-500 bg-gold-500 text-black'
                        : 'border-gray-600 hover:border-gold-400 text-white'
                    }`}
                  >
                    <div className="font-semibold">{format(new Date(date + 'T00:00:00'), 'EEE')}</div>
                    <div className="text-sm">{format(new Date(date + 'T00:00:00'), 'MMM d')}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Select Time */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Time</h2>
              {availableSlots.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No available slots for this date</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 border rounded text-center transition-colors ${
                        selectedSlot === slot
                          ? 'border-gold-500 bg-gold-500 text-black'
                          : 'border-gray-600 hover:border-gold-400 text-white'
                      }`}
                    >
                      <div className="font-semibold">
                        {format(new Date(slot.slot_start), 'HH:mm')}
                      </div>
                      {selectedBarber === null && (
                        <div className="text-xs opacity-75">{slot.barber_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Confirm Booking</h2>
              <div className="space-y-4 mb-6">
                <div className="bg-dark-700 p-4 rounded">
                  <h3 className="font-semibold text-gold-500 mb-2">Booking Details</h3>
                  <p className="text-white"><span className="text-gray-400">Service:</span> {selectedService?.name}</p>
                  <p className="text-white"><span className="text-gray-400">Barber:</span> {selectedSlot?.barber_name || selectedBarber?.display_name}</p>
                  <p className="text-white"><span className="text-gray-400">Date:</span> {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
                  <p className="text-white"><span className="text-gray-400">Time:</span> {format(new Date(selectedSlot?.slot_start), 'HH:mm')}</p>
                  <p className="text-white"><span className="text-gray-400">Price:</span> {shopSettings?.currency || '$'}{selectedService?.price}</p>
                </div>

                {!user && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        className="input w-full"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes (Optional)</label>
                  <textarea
                    className="input w-full"
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Back
            </button>
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="btn-primary disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleBooking}
                disabled={!canProceed() || loading}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
