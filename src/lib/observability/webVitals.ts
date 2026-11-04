import { onCLS, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

// Toggle for ad-hoc local debugging.
const LOG_TO_CONSOLE =
  import.meta.env.DEV || import.meta.env.VITE_LOG_WEB_VITALS === '1'

/**
 * Report Core Web Vitals (LCP, CLS, INP, TTFB) for the current visit. Call
 * once at app startup. By default it just logs to the console — wire
 * `dispatch` to Vercel Analytics, a Supabase table, or any other endpoint
 * when you want real telemetry.
 */
export function reportWebVitals(
  dispatch: (metric: Metric) => void = defaultDispatch,
): void {
  // web-vitals lazily wires up the Performance Observer; calling these is
  // cheap and doesn't block the main thread.
  onLCP(dispatch)
  onCLS(dispatch)
  onINP(dispatch)
  onTTFB(dispatch)
}

function defaultDispatch(metric: Metric): void {
  if (!LOG_TO_CONSOLE) return
  // Group by name and rating for at-a-glance scanning in DevTools.
  console.info(
    `[web-vitals] ${metric.name} ${metric.value.toFixed(1)} (${metric.rating})`,
    metric,
  )
}
