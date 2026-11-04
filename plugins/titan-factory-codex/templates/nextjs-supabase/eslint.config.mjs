import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import { fixupConfigRules } from '@eslint/compat'

const config = [
  // Some bundled React/import rules still use the older context API.
  ...fixupConfigRules([...nextVitals, ...nextTypescript]),
  { ignores: ['.next/**', 'out/**', 'next-env.d.ts'] },
]

export default config
