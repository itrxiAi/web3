import {defineRouting} from 'next-intl/routing';
 
export const routing = defineRouting({
  // 中、英
  locales: ['zh', 'en'],
  defaultLocale: 'en',
  // Disable locale detection to always use default locale
  localeDetection: false,
});