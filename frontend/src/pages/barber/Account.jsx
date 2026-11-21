import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { User } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function BarberAccount() {
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useLanguage()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setPhone(profile?.phone || '')
  }, [profile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      return toast.error(t('b.ac.mismatch'))
    }

    setSaving(true)
    try {
      const profileUpdates = {}
      if (fullName.trim() !== (profile?.full_name || '')) {
        profileUpdates.full_name = fullName.trim() || null
      }
      if (phone.trim() !== (profile?.phone || '')) {
        profileUpdates.phone = phone.trim() || null
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id)
        if (error) throw error
      }

      const authUpdates = {}
      if (newEmail.trim() && newEmail.trim().toLowerCase() !== user.email?.toLowerCase()) {
        authUpdates.email = newEmail.trim()
      }
      if (newPassword) authUpdates.password = newPassword

      if (Object.keys(authUpdates).length > 0) {
        const { error } = await supabase.auth.updateUser(authUpdates)
        if (error) throw error
      }

      await refreshProfile()
      setNewEmail('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('b.ac.saved'))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center">
          <User className="h-6 w-6 text-gold-500 mr-3" />
          {t('b.ac.title')}
        </h2>
        <p className="text-sm text-gray-400 mt-1">{t('b.ac.help')}</p>
      </div>

      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('b.ac.email')}</label>
            <input type="email" className="input w-full bg-dark-800" value={user?.email || ''} disabled />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.ac.fullName')}</label>
              <input
                type="text"
                className="input w-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.ac.phone')}</label>
              <input
                type="tel"
                className="input w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.ac.newEmail')}</label>
              <input
                type="email"
                className="input w-full"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.ac.password')}</label>
              <input
                type="password"
                minLength={6}
                className="input w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('b.ac.confirmPassword')}</label>
              <input
                type="password"
                className="input w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? t('b.wt.saving') : t('a.save')}
          </button>
        </form>
      </div>
    </div>
  )
}
