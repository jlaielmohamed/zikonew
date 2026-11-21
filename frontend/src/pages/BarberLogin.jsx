import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../i18n/LanguageContext'

export default function BarberLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signOut } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await signIn(email.trim(), password)
      if (error) throw error

      const userId = data?.user?.id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      if (profile?.role !== 'barber') {
        await signOut()
        toast.error(t('barberLogin.wrongRole'))
        return
      }

      toast.success(t('login.success'))
      navigate('/barber')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <img src="/logo.jpg" alt="Ziko Hairstyle" className="h-20 w-20 rounded-full object-cover" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">{t('barberLogin.title')}</h2>
          <p className="mt-2 text-sm text-gray-400">{t('barberLogin.subtitle')}</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="barber-email" className="block text-sm font-medium text-gray-300">
                {t('auth.email')}
              </label>
              <input
                id="barber-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="input w-full mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="barber-password" className="block text-sm font-medium text-gray-300">
                {t('auth.password')}
              </label>
              <input
                id="barber-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input w-full mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 disabled:opacity-50"
          >
            {loading ? t('barberLogin.signingIn') : t('barberLogin.signIn')}
          </button>
        </form>

      </div>
    </div>
  )
}
