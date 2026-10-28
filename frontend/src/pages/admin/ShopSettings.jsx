import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Settings } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function ShopSettings() {
  const { t } = useLanguage()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data } = await supabase.from('shop_settings').select('*').single()
    setSettings(data)
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('shop_settings').update(settings).eq('id', 1)
      if (error) throw error
      toast.success(t('a.st.saved'))
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Settings className="h-8 w-8 text-gold-500 mr-3" />
        {t('a.menu.settings')}
      </h1>

      <div className="card">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('a.st.shopName')}</label>
              <input type="text" className="input w-full" value={settings.shop_name || ''} onChange={(e) => setSettings({...settings, shop_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('a.phone')}</label>
              <input type="text" className="input w-full" value={settings.phone || ''} onChange={(e) => setSettings({...settings, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('a.st.address')}</label>
              <input type="text" className="input w-full" value={settings.address || ''} onChange={(e) => setSettings({...settings, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('a.st.city')}</label>
              <input type="text" className="input w-full" value={settings.city || ''} onChange={(e) => setSettings({...settings, city: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">{t('a.st.description')}</label>
            <textarea className="input w-full" value={settings.description || ''} onChange={(e) => setSettings({...settings, description: e.target.value})} />
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={settings.auto_accept_bookings || false} onChange={(e) => setSettings({...settings, auto_accept_bookings: e.target.checked})} />
            <label className="text-gray-300">{t('a.st.autoAccept')}</label>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={settings.is_open_for_booking || false} onChange={(e) => setSettings({...settings, is_open_for_booking: e.target.checked})} />
            <label className="text-gray-300">{t('a.st.openForBooking')}</label>
          </div>
          <button type="submit" className="btn-primary">{t('a.st.save')}</button>
        </form>
      </div>
    </div>
  )
}
