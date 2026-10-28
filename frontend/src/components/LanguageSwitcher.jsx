import { useLanguage } from '../i18n/LanguageContext'

export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang, t } = useLanguage()

  return (
    <div role="group" aria-label={t('nav.language')} className={`inline-flex rounded overflow-hidden border border-gold-500 ${className}`}>
      {['en', 'fr'].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-3 py-1 text-sm font-semibold transition-colors ${
            lang === code ? 'bg-gold-500 text-black' : 'text-gray-300 hover:text-gold-500'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
