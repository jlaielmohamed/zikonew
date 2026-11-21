import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../i18n/LanguageContext'
import {
  BARBER_GOOGLE_LOGIN_FLAG,
  BARBER_GOOGLE_WRONG_ROLE_FLAG,
} from '../config/authFlags'

export default function BarberLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signOut, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionStorage.getItem(BARBER_GOOGLE_WRONG_ROLE_FLAG) === '1') {
      sessionStorage.removeItem(BARBER_GOOGLE_WRONG_ROLE_FLAG)
      toast.error(t('barberLogin.wrongRole'))
    }
  }, [t])

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

  const handleGoogle = async () => {
    setLoading(true)

    // Use the same redirect URL as the working main login page. Supabase only
    // allows the site root here; the flag lets AppRoutes continue to /barber.
    sessionStorage.setItem(BARBER_GOOGLE_LOGIN_FLAG, '1')

    const { error } = await signInWithGoogle()

    if (error) {
      sessionStorage.removeItem(BARBER_GOOGLE_LOGIN_FLAG)
      toast.error(error.message)
      setLoading(false)
    }
    // On success Supabase redirects to Google and back to the site root.
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

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-dark-700"></div>
            <span className="text-sm text-gray-500">{t('login.or')}</span>
            <div className="flex-1 h-px bg-dark-700"></div>
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-4 w-full py-3 flex items-center justify-center gap-3 border border-dark-700 rounded text-white hover:bg-dark-700 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.75 24c0-1.6.27-3.15.78-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {t('auth.google')}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            {t('barberLogin.googleHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
