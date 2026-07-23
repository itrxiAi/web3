'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import globeIcon from '@/public/images/globe-icon.svg'

import enFlag from '@/public/images/flags/en.svg'
import zhFlag from '@/public/images/flags/zh.svg'

type Locale = (typeof routing.locales)[number]

const languageMap: Record<Locale, { name: string; flag: typeof enFlag }> = {
  zh: { name: '简体中文', flag: zhFlag },
  en: { name: 'English', flag: enFlag },
}

const localeShortCode: Record<Locale, string> = {
  zh: 'CN',
  en: 'EN',
}

export default function LanguageSelector({
  showLocaleCode,
  dropUp,
}: {
  showLocaleCode?: boolean
  dropUp?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const currentLocale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const tCommon = useTranslations('common')

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const switchLanguage = (locale: Locale) => {
    if (locale === currentLocale) {
      setIsOpen(false)
      return
    }
    router.push(pathname, { locale })
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={
          showLocaleCode
            ? 'flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-white/90 transition hover:bg-white/10'
            : 'flex h-6 w-6 cursor-pointer items-center justify-center'
        }
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={tCommon('language_menu')}
      >
        <Image src={globeIcon} alt="" width={18} height={18} className="shrink-0 opacity-90" />
        {showLocaleCode && (
          <span className="min-w-[1.5rem] text-start text-sm font-medium tracking-wide">
            {localeShortCode[currentLocale]}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute end-0 z-[60] w-48 rounded-md border border-gray-700 bg-black shadow-lg ${
            dropUp ? 'bottom-full mb-2' : 'mt-2'
          }`}
        >
          <div className="py-1">
            {routing.locales.map((locale) => (
              <button
                key={locale}
                type="button"
                className={`flex w-full items-center px-4 py-2 text-sm ${
                  locale === currentLocale ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
                onClick={() => switchLanguage(locale)}
              >
                <Image
                  src={languageMap[locale].flag}
                  alt=""
                  width={20}
                  height={20}
                  className="me-2 shrink-0"
                />
                <span className="min-w-0 flex-1 text-start">{languageMap[locale].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
