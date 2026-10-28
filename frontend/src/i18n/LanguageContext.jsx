import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { enUS } from 'date-fns/locale/en-US'
import { fr } from 'date-fns/locale/fr'
import { translations } from './translations'

const STORAGE_KEY = 'ziko_lang'
const CURRENCY = 'DT' // Tunisian dinar
const LOCALES = { en: { date: enUS, number: 'en-US' }, fr: { date: fr, number: 'fr-FR' } }

const LanguageContext = createContext(null)

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'fr') return saved
  } catch (e) {
    // storage can be unavailable (private mode); fall through
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch (e) {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key) => translations[lang][key] ?? translations.en[key] ?? key,
    [lang]
  )

  // 25 -> "25 DT", 12.5 -> "12.5 DT" (fr: "12,5 DT")
  const formatPrice = useCallback(
    (amount) =>
      `${Number(amount).toLocaleString(LOCALES[lang].number, { maximumFractionDigits: 3 })} ${CURRENCY}`,
    [lang]
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, formatPrice, dateLocale: LOCALES[lang].date }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
