import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Edit } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Services() {
  const { t, formatPrice } = useLanguage()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', duration_minutes: 30, price: 0, category: '', is_active: true })

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').order('sort_order')
    setServices(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('services').insert([formData])
      if (error) throw error
      toast.success(t('a.sv.added'))
      setShowModal(false)
      fetchServices()
      setFormData({ name: '', description: '', duration_minutes: 30, price: 0, category: '', is_active: true })
    } catch (error) {
      toast.error(error.message)
    }
  }

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('services').update({ is_active: !current }).eq('id', id)
    if (!error) {
      toast.success(t('a.updated'))
      fetchServices()
    }
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('a.menu.services')}</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center whitespace-nowrap">
          <Plus className="h-4 w-4 mr-2" /> {t('a.sv.add')}
        </button>
      </div>

      <div className="card hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-3">{t('a.name')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.sv.duration')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.price')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.status')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-gray-700/50">
                <td className="py-3 text-white">{service.name}</td>
                <td className="py-3 text-gray-300">{service.duration_minutes} {t('home.min')}</td>
                <td className="py-3 text-gold-500">{formatPrice(service.price)}</td>
                <td className="py-3">
                  <button onClick={() => toggleActive(service.id, service.is_active)} className={`px-2 py-1 rounded text-xs ${service.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                    {service.is_active ? t('a.active') : t('a.inactive')}
                  </button>
                </td>
                <td className="py-3">
                  <button className="p-1 text-blue-500 hover:bg-blue-500/10 rounded" aria-label={t('a.edit')}><Edit className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards for phones */}
      <div className="sm:hidden space-y-3">
        {services.map((service) => (
          <div key={service.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold break-words">{service.name}</p>
                <p className="text-gray-400 text-sm">{service.duration_minutes} {t('home.min')}</p>
              </div>
              <p className="text-gold-500 font-semibold flex-shrink-0">{formatPrice(service.price)}</p>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700">
              <button onClick={() => toggleActive(service.id, service.is_active)} className={`px-2 py-1 rounded text-xs ${service.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                {service.is_active ? t('a.active') : t('a.inactive')}
              </button>
              <button className="ml-auto p-1 text-blue-500 hover:bg-blue-500/10 rounded" aria-label={t('a.edit')}><Edit className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">{t('a.sv.add')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder={t('a.name')} required className="input w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <textarea placeholder={t('a.sv.description')} className="input w-full" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="number" placeholder={t('a.sv.durationMin')} required className="input w-full" value={formData.duration_minutes} onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} />
                <input type="number" step="0.01" placeholder={t('a.price')} required className="input w-full" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})} />
              </div>
              <input type="text" placeholder={t('a.sv.category')} className="input w-full" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('a.save')}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">{t('a.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
