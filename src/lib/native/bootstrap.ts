import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { queryClient } from '../../app/providers/queryClient'
import { isNative } from './platform'

// Query keys whose data is time-sensitive enough to refresh whenever the user
// returns to the app from background. Anything else stays cached and is only
// re-fetched on stale-time expiry the normal way.
const FOREGROUND_REFRESH_KEYS: ReadonlyArray<readonly string[]> = [
  ['notifications'],
  ['user-dashboard'],
  ['admin-dashboard-stats'],
  ['admin-recent-invoices'],
]

let splashHidden = false

/**
 * Runs once at app startup. Configures status bar and wires the hardware
 * back button on Android to history.back(). The native splash is NOT hidden
 * here — call `hideNativeSplash()` after auth resolves so the user goes
 * straight from splash to a meaningful screen instead of a "Cargando…"
 * placeholder. Safe to call from web — short-circuits when not native.
 */
export async function bootstrapNative(): Promise<void> {
  if (!isNative()) return

  // Tag the document so CSS can opt into native-only styling
  // (no tap highlight, no text selection outside fields, etc.).
  document.documentElement.classList.add('capacitor-native')

  // Status bar — cream background, dark icons (we pass `Light` content
  // because StatusBar.Style.Light = light content / dark background; we
  // want the opposite, so use `Dark`).
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#FBF7F0' })
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch {
    // Older Android may reject some calls — non-fatal.
  }

  // Hardware back button on Android: pop history if possible, otherwise
  // exit the app. The default capacitor behaviour exits immediately, which
  // is jarring inside a multi-screen SPA.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })

  // When the user returns from background, refresh time-sensitive data only
  // (notifications + dashboards). Everything else keeps its cached snapshot
  // until staleTime expires — avoids a refetch storm on resume.
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return
    for (const key of FOREGROUND_REFRESH_KEYS) {
      void queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' })
    }
  })

  // Safety net: if auth never resolves (network down, Supabase outage), force
  // the splash off after 5 s so the user at least sees login or an error.
  window.setTimeout(() => void hideNativeSplash(), 5000)
}

/**
 * Idempotent. Called from `AuthProvider` once the session is resolved so the
 * splash hides only when there is real UI to show (login/landing/dashboard).
 * On web this is a no-op.
 *
 * Waits for two animation frames before triggering the fade so the post-splash
 * UI has actually been committed to the screen — otherwise the fade can
 * briefly reveal a blank/unstyled frame on slower devices.
 */
export async function hideNativeSplash(): Promise<void> {
  if (!isNative() || splashHidden) return
  splashHidden = true
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  try {
    await SplashScreen.hide({ fadeOutDuration: 220 })
  } catch {
    /* ignore */
  }
}
