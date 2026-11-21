import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Scissors } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function BarberServices({ barber }) {
  const { t, formatPrice } = useLanguage()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [barber.id])

  const fetchServices = async () => {
    setLoading(true)
    const [shopRes, linksRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('barber_services').select('*').eq('barber_id', barber.id),
    ])

    if (shopRes.error || linksRes.error) {
      toast.error(shopRes.error?.message || linksRes.error?.message)
    }

    const links = new Map((linksRes.data || []).map((link) => [link.service_id, link]))
    setServices(
      (shopRes.data || []).map((service) => {
        const link = links.get(service.id)
        return {
          ...service,
          enabled: link ? link.is_active : false,
          custom_price: link?.custom_price ?? service.price,
          custom_duration_minutes: link?.custom_duration_minutes ?? service.duration_minutes,
        }
      })
    )
    setLoading(false)
  }

  const updateField = (id, field, value) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const saveService = async (service, enabled = service.enabled) => {
    if (enabled && (!service.custom_price || Number(service.custom_price) < 0)) {
      return toast.error(t('b.sv.help'))
    }
    if (enabled && (!service.custom_duration_minutes || Number(service.custom_duration_minutes) <= 0)) {
      return toast.error(t('b.sv.duration'))
    }

    const { error } = await supabase.from('barber_services').upsert(
      {
        barber_id: barber.id,
        service_id: service.id,
        custom_price: Number(service.custom_price),
        custom_duration_minutes: Number(service.custom_duration_minutes),
        is_active: enabled,
      },
      { onConflict: 'barber_id,service_id' }
    )

    if (error) return toast.error(error.message)

    updateField(service.id, 'enabled', enabled)
    toast.success(t('b.sv.saved'))
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Scissors className="h-6 w-6 text-gold-500 mr-3" />
          {t('b.sv.title')}
        </h2>
        <p className="text-sm text-gray-400 mt-1">{t('b.sv.help')}</p>
      </div>

      <div className="card space-y-4">
        {services.length === 0 && (
          <p className="text-gray-400 text-center py-8">{t('b.noAppointments')}</p>
        )}

        {services.map((service) => (
          <div
            key={service.id}
            className={`p-4 rounded-lg ${service.enabled ? 'bg-dark-700' : 'bg-dark-800 opacity-75'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{service.name}</p>
                <p className="text-gray-400 text-sm">
                  {service.description} · {t('b.sv.shopPrice')}: {formatPrice(service.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveService(service, !service.enabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  service.enabled ? 'bg-green-500 text-white' : 'bg-gray-600 text-white'
                }`}
              >
                {service.enabled ? t('b.sv.offer') : t('b.sv.notOffered')}
              </button>
            </div>

            {service.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('b.sv.yourPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-full"
                    value={service.custom_price}
                    onChange={(e) => updateField(service.id, 'custom_price', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('b.sv.duration')}</label>
                  <input
                    type="number"
                    min="1"
                    className="input w-full"
                    value={service.custom_duration_minutes}
                    onChange={(e) => updateField(service.id, 'custom_duration_minutes', e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => saveService(service)}
                    className="btn-primary w-full"
                  >
                    {t('b.sv.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
