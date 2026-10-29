import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isNative } from '../../lib/native/platform'
import { useDocumentMeta } from '../../lib/seo/useDocumentMeta'
import { LANDING_STRINGS, type LandingLang, type LandingStrings } from './landingStrings'

const COLORS = {
  cream: '#fbf7f0',
  creamSunken: '#f4ede0',
  creamBorder: '#e6dcc6',
  ink: '#2a1f17',
  inkDeep: '#1a1410',
  inkSoft: '#5a4636',
  terracotta: '#c2410c',
  terracottaSoft: 'rgba(194,65,12,0.35)',
}

const FONTS = {
  display: "'Fraunces', 'Instrument Serif', Georgia, serif",
  sans: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
}

function useDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode
  delay?: number
  style?: CSSProperties
}) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        transition: 'opacity 700ms ease, transform 700ms cubic-bezier(0.2,0.7,0.2,1)',
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SlashMark({ size = 24, color = COLORS.ink }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M42 10 L22 54"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <rect x="46" y="44" width="11" height="7" rx="1" fill={color} />
      <circle cx="11" cy="18" r="2.5" fill={color} opacity={0.55} />
      <circle cx="19" cy="18" r="2.5" fill={color} opacity={0.55} />
    </svg>
  )
}

function TerminalBlock({
  lines,
  scale = 1,
  theme = 'dark',
}: {
  lines: string[]
  scale?: number
  theme?: 'dark' | 'light'
}) {
  const [shown, setShown] = useState(0)
  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const id = window.setInterval(
      () => setShown((s) => (s < lines.length ? s + 1 : s)),
      800,
    )
    return () => window.clearInterval(id)
  }, [lines.length])
  useEffect(() => {
    const id = window.setInterval(() => setBlink((b) => !b), 500)
    return () => window.clearInterval(id)
  }, [])
  const dark = theme === 'dark'
  return (
    <div
      style={{
        background: dark ? COLORS.inkDeep : COLORS.cream,
        border: dark ? 'none' : `1px solid ${COLORS.creamBorder}`,
        borderRadius: 12 * scale,
        padding: 18 * scale,
        fontFamily: FONTS.mono,
        fontSize: 12 * scale,
        lineHeight: 1.65,
        color: dark ? COLORS.cream : COLORS.ink,
        minHeight: 130 * scale,
      }}
    >
      {lines.slice(0, shown).map((l, i) => (
        <div
          key={i}
          style={{
            color: l.startsWith('$')
              ? COLORS.terracotta
              : l.startsWith('✓')
                ? '#7eb069'
                : dark
                  ? COLORS.cream
                  : COLORS.ink,
            opacity: l.startsWith('$') ? 1 : 0.85,
          }}
        >
          {l}
        </div>
      ))}
      {shown < lines.length && <div style={{ color: COLORS.terracotta }}>...</div>}
      {shown >= lines.length && (
        <div style={{ color: COLORS.terracotta }}>
          ${' '}
          <span
            style={{
              background: blink ? COLORS.terracotta : 'transparent',
              color: blink ? (dark ? COLORS.inkDeep : COLORS.cream) : COLORS.terracotta,
              padding: '0 4px',
            }}
          >
            _
          </span>
        </div>
      )}
    </div>
  )
}

function Header({
  s,
  lang,
  setLang,
  desktop,
  onLogin,
}: {
  s: LandingStrings
  lang: LandingLang
  setLang: (l: LandingLang) => void
  desktop: boolean
  onLogin: () => void
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: desktop ? '20px 56px' : '18px 22px',
        borderBottom: `1px solid ${COLORS.creamBorder}`,
        background: COLORS.cream,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        fontFamily: FONTS.sans,
      }}
    >
      <a
        href="#top"
        aria-label="Invoxa — inicio"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <SlashMark size={desktop ? 26 : 22} color={COLORS.ink} />
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: desktop ? 22 : 19,
            color: COLORS.ink,
            letterSpacing: '-0.03em',
            fontWeight: 500,
          }}
        >
          invoxa
        </span>
      </a>
      {desktop && (
        <nav
          aria-label="Principal"
          style={{
            display: 'flex',
            gap: 28,
            fontSize: 13,
            color: COLORS.inkSoft,
          }}
        >
          <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>
            {s.nav.product}
          </a>
          <a href="#how" style={{ color: 'inherit', textDecoration: 'none' }}>
            {s.nav.how}
          </a>
          <a href="#cases" style={{ color: 'inherit', textDecoration: 'none' }}>
            {s.nav.cases}
          </a>
          <a href="#faq" style={{ color: 'inherit', textDecoration: 'none' }}>
            {s.nav.faq}
          </a>
        </nav>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: desktop ? 14 : 10 }}>
        <button
          type="button"
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          style={{
            background: 'transparent',
            border: '1px solid #d8c8a8',
            color: COLORS.ink,
            fontFamily: FONTS.mono,
            fontSize: 11,
            padding: '5px 9px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {lang.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={onLogin}
          style={{
            background: COLORS.terracotta,
            color: COLORS.cream,
            border: 'none',
            fontSize: desktop ? 13 : 12,
            fontWeight: 600,
            padding: desktop ? '9px 18px' : '7px 13px',
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: FONTS.sans,
          }}
        >
          {s.nav.login}
        </button>
      </div>
    </header>
  )
}

function Hero({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      style={{
        background: COLORS.inkDeep,
        color: COLORS.cream,
        overflow: 'hidden',
        padding: desktop ? '90px 56px 110px' : '60px 22px 70px',
        position: 'relative',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none' }}
        aria-hidden
      >
        {Array.from({ length: 16 }).map((_, r) =>
          Array.from({ length: 12 }).map((_, c) => (
            <line
              key={`${r}-${c}`}
              x1={c * 9 - 2}
              y1={r * 7 + 5}
              x2={c * 9 + 4}
              y2={r * 7 - 1}
              stroke={COLORS.terracotta}
              strokeWidth="0.6"
            />
          )),
        )}
      </svg>
      <div
        style={{
          position: 'relative',
          maxWidth: desktop ? 1200 : '100%',
          margin: '0 auto',
          display: desktop ? 'grid' : 'block',
          gridTemplateColumns: desktop ? '1.2fr 1fr' : '1fr',
          gap: desktop ? 56 : 40,
          alignItems: 'center',
        }}
      >
        <div>
          <Reveal>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.terracotta,
                marginBottom: 22,
                fontFamily: FONTS.mono,
              }}
            >
              {s.hero.eyebrow}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1
              id="hero-title"
              style={{
                fontFamily: FONTS.display,
                fontSize: desktop ? 76 : 44,
                letterSpacing: '-0.04em',
                fontWeight: 500,
                lineHeight: 1,
                margin: 0,
                marginBottom: 26,
                whiteSpace: 'pre-line',
              }}
            >
              {s.hero.title}
            </h1>
          </Reveal>
          <Reveal delay={220}>
            <div
              style={{
                fontSize: desktop ? 18 : 15,
                color: 'rgba(251,247,240,0.7)',
                lineHeight: 1.55,
                maxWidth: 540,
                fontFamily: FONTS.display,
                marginBottom: 32,
              }}
            >
              {s.hero.subtitle}
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  background: COLORS.terracotta,
                  color: COLORS.cream,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '14px 26px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: FONTS.sans,
                  boxShadow: `0 8px 24px ${COLORS.terracottaSoft}`,
                }}
              >
                {s.hero.cta} →
              </button>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(251,247,240,0.5)',
                  fontFamily: FONTS.mono,
                }}
              >
                {s.hero.ctaSub}
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={400}>
          <div style={{ marginTop: desktop ? 0 : 40, position: 'relative' }}>
            <TerminalBlock lines={s.hero.terminal} scale={desktop ? 1.15 : 0.95} />
            <div
              style={{
                position: 'absolute',
                top: -14,
                right: 14,
                background: COLORS.terracotta,
                color: COLORS.cream,
                fontSize: 9,
                padding: '3px 8px',
                borderRadius: 999,
                fontFamily: FONTS.mono,
                letterSpacing: '0.08em',
              }}
            >
              LIVE · MAY 2026
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Manifest({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      id="about"
      aria-labelledby="manifest-title"
      style={{ background: COLORS.cream, padding: desktop ? '110px 56px' : '70px 22px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.terracotta,
              marginBottom: 18,
              fontFamily: FONTS.mono,
            }}
          >
            {s.manifest.tag}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2
            id="manifest-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 56 : 36,
              color: COLORS.ink,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              lineHeight: 1.05,
              maxWidth: 800,
              margin: 0,
              marginBottom: 28,
            }}
          >
            {s.manifest.title}
          </h2>
        </Reveal>
        <Reveal delay={220}>
          <div
            style={{
              fontSize: desktop ? 18 : 15,
              color: COLORS.inkSoft,
              lineHeight: 1.6,
              maxWidth: 720,
              fontFamily: FONTS.display,
              marginBottom: 48,
            }}
          >
            {s.manifest.body}
          </div>
        </Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr',
            gap: desktop ? 28 : 18,
          }}
        >
          {s.manifest.pillars.map((p, i) => (
            <Reveal key={i} delay={300 + i * 100}>
              <div style={{ borderTop: `1px solid ${COLORS.ink}`, paddingTop: 18 }}>
                <h3
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 22,
                    color: COLORS.ink,
                    letterSpacing: '-0.02em',
                    fontWeight: 500,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {p.k}
                </h3>
                <div
                  style={{
                    fontSize: 13,
                    color: COLORS.inkSoft,
                    lineHeight: 1.55,
                    fontFamily: FONTS.sans,
                  }}
                >
                  {p.v}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function How({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      style={{ background: COLORS.creamSunken, padding: desktop ? '110px 56px' : '70px 22px' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.terracotta,
              marginBottom: 16,
              fontFamily: FONTS.mono,
            }}
          >
            {s.how.tag}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="how-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 50 : 32,
              color: COLORS.ink,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 56,
              maxWidth: 720,
            }}
          >
            {s.how.title}
          </h2>
        </Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: desktop ? '1fr 1fr' : '1fr',
            gap: desktop ? 48 : 56,
            alignItems: 'flex-start',
          }}
        >
          {[s.how.admin, s.how.user].map((role, i) => (
            <Reveal key={i} delay={i * 150}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 12px',
                    background: i === 0 ? COLORS.ink : COLORS.terracotta,
                    color: COLORS.cream,
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    fontFamily: FONTS.sans,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: COLORS.cream,
                    }}
                  />
                  {role.role.toUpperCase()} · {role.name}
                </div>
                <ol
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {role.actions.map((a, j) => (
                    <li
                      key={j}
                      style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: COLORS.terracotta,
                          fontFamily: FONTS.mono,
                          minWidth: 22,
                          paddingTop: 2,
                        }}
                      >
                        {String(j + 1).padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          color: COLORS.ink,
                          fontFamily: FONTS.display,
                          lineHeight: 1.45,
                        }}
                      >
                        {a}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      style={{ background: COLORS.cream, padding: desktop ? '110px 56px' : '70px 22px' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.terracotta,
              marginBottom: 16,
              fontFamily: FONTS.mono,
            }}
          >
            {s.features.tag}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="features-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 50 : 32,
              color: COLORS.ink,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 48,
              maxWidth: 720,
            }}
          >
            {s.features.title}
          </h2>
        </Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr',
            gap: desktop ? 22 : 16,
          }}
        >
          {s.features.items.map((f, i) => (
            <Reveal key={i} delay={i * 80}>
              <div
                style={{
                  background: '#fff',
                  border: `1px solid ${COLORS.creamBorder}`,
                  borderRadius: 14,
                  padding: 26,
                  height: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: COLORS.inkDeep,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SlashMark size={22} color={COLORS.terracotta} />
                </div>
                <h3
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 22,
                    color: COLORS.ink,
                    letterSpacing: '-0.02em',
                    fontWeight: 500,
                    margin: 0,
                    marginTop: 6,
                  }}
                >
                  {f.t}
                </h3>
                <div
                  style={{
                    fontSize: 13,
                    color: COLORS.inkSoft,
                    lineHeight: 1.55,
                    fontFamily: FONTS.sans,
                  }}
                >
                  {f.d}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: COLORS.terracotta,
                    fontFamily: FONTS.mono,
                    marginTop: 'auto',
                    paddingTop: 14,
                    borderTop: `1px solid ${COLORS.creamSunken}`,
                    letterSpacing: '0.08em',
                  }}
                >
                  FEATURE-{String(i + 1).padStart(2, '0')}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cases({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      id="cases"
      aria-labelledby="cases-title"
      style={{
        background: COLORS.ink,
        color: COLORS.cream,
        padding: desktop ? '110px 56px' : '70px 22px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.terracotta,
              marginBottom: 16,
              fontFamily: FONTS.mono,
            }}
          >
            {s.cases.tag}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="cases-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 50 : 32,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 48,
            }}
          >
            {s.cases.title}
          </h2>
        </Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr',
            gap: 18,
          }}
        >
          {s.cases.items.map((c, i) => (
            <Reveal key={i} delay={i * 100}>
              <div
                style={{
                  borderTop: '1px solid rgba(251,247,240,0.18)',
                  paddingTop: 22,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.terracotta,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.08em',
                  }}
                >
                  {c.who.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(251,247,240,0.65)',
                    fontFamily: FONTS.sans,
                  }}
                >
                  {c.sit}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 22,
                    letterSpacing: '-0.02em',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    marginTop: 'auto',
                  }}
                >
                  {c.res}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  const [open, setOpen] = useState(0)
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      style={{ background: COLORS.cream, padding: desktop ? '110px 56px' : '70px 22px' }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.terracotta,
              marginBottom: 16,
              fontFamily: FONTS.mono,
            }}
          >
            {s.faq.tag}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="faq-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 50 : 32,
              color: COLORS.ink,
              letterSpacing: '-0.035em',
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 40,
            }}
          >
            {s.faq.title}
          </h2>
        </Reveal>
        <div>
          {s.faq.items.map((f, i) => {
            const isOpen = open === i
            const panelId = `faq-panel-${i}`
            const buttonId = `faq-button-${i}`
            return (
              <Reveal key={i} delay={i * 60}>
                <div
                  style={{
                    borderTop: `1px solid ${COLORS.creamBorder}`,
                    padding: '18px 0',
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 18,
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: FONTS.display,
                        fontSize: desktop ? 22 : 18,
                        color: COLORS.ink,
                        letterSpacing: '-0.02em',
                        fontWeight: 500,
                      }}
                    >
                      <span>{f.q}</span>
                      <span
                        aria-hidden
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: `1px solid ${COLORS.ink}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          color: COLORS.ink,
                          flexShrink: 0,
                          transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
                          transition: 'transform 250ms',
                        }}
                      >
                        +
                      </span>
                    </button>
                  </h3>
                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      style={{
                        fontSize: 14,
                        color: COLORS.inkSoft,
                        fontFamily: FONTS.display,
                        lineHeight: 1.55,
                        marginTop: 12,
                        maxWidth: 700,
                      }}
                    >
                      {f.a}
                    </div>
                  )}
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CTA({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <section
      aria-labelledby="cta-title"
      style={{
        background: COLORS.inkDeep,
        color: COLORS.cream,
        padding: desktop ? '110px 56px' : '80px 22px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.06,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <SlashMark size={desktop ? 600 : 360} color={COLORS.terracotta} />
      </div>
      <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
        <Reveal>
          <h2
            id="cta-title"
            style={{
              fontFamily: FONTS.display,
              fontSize: desktop ? 64 : 38,
              letterSpacing: '-0.04em',
              fontWeight: 500,
              lineHeight: 1,
              margin: 0,
              marginBottom: 22,
            }}
          >
            {s.cta.title}
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div
            style={{
              fontSize: desktop ? 17 : 14,
              color: 'rgba(251,247,240,0.65)',
              fontFamily: FONTS.display,
              marginBottom: 32,
              lineHeight: 1.55,
            }}
          >
            {s.cta.sub}
          </div>
        </Reveal>
        <Reveal delay={220}>
          <button
            type="button"
            style={{
              background: COLORS.terracotta,
              color: COLORS.cream,
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              padding: '14px 28px',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: FONTS.sans,
              boxShadow: `0 10px 30px ${COLORS.terracottaSoft}`,
            }}
          >
            {s.cta.btn} →
          </button>
        </Reveal>
      </div>
    </section>
  )
}

function Footer({ s, desktop }: { s: LandingStrings; desktop: boolean }) {
  return (
    <footer
      style={{
        background: COLORS.inkDeep,
        color: 'rgba(251,247,240,0.6)',
        padding: desktop ? '40px 56px' : '32px 22px',
        borderTop: '1px solid rgba(251,247,240,0.08)',
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: desktop ? 'grid' : 'flex',
          gridTemplateColumns: desktop ? '2fr 1fr 1fr 1fr' : '1fr',
          flexDirection: 'column',
          gap: desktop ? 36 : 24,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <SlashMark size={20} color={COLORS.cream} />
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: 18,
                color: COLORS.cream,
                letterSpacing: '-0.03em',
                fontWeight: 500,
              }}
            >
              invoxa
            </span>
          </div>
          <div style={{ fontSize: 11, fontFamily: FONTS.mono }}>
            {s.footer.by}{' '}
            <a
              href="https://fullkod.com/?ref=invoxa"
              target="_blank"
              rel="noopener"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                verticalAlign: 'bottom',
                color: COLORS.cream,
                textDecoration: 'none',
              }}
            >
              <img src="/brand/fullkod-symbol-reversed.svg" alt="" width={12} height={12} />
              FULLKOD
            </a>{' '}
            · 2026
          </div>
        </div>
        {s.footer.cols.map((c, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 10,
                color: COLORS.terracotta,
                fontFamily: FONTS.mono,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              {c.t}
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 12,
              }}
            >
              {c.l.map((l, j) => (
                <li key={j} style={{ color: 'rgba(251,247,240,0.6)' }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  )
}

const META_BY_LANG: Record<LandingLang, { title: string; description: string }> = {
  es: {
    title: 'Invoxa — Facturación inteligente para equipos creativos',
    description:
      'Invoxa centraliza horas, proyectos y facturas de tu equipo creativo. Tú apruebas, el sistema entrega el PDF al cliente.',
  },
  en: {
    title: 'Invoxa — Smart invoicing for creative teams',
    description:
      'Invoxa centralizes hours, projects and invoices for your creative team. You approve, Invoxa delivers the PDF.',
  },
}

export function LandingPage() {
  const navigate = useNavigate()
  const desktop = useDesktop()
  const [lang, setLang] = useState<LandingLang>('es')

  const meta = META_BY_LANG[lang]
  useDocumentMeta({
    title: meta.title,
    description: meta.description,
    canonical: 'https://invoxa-ten.vercel.app/',
  })

  // The landing is web-only — never expose it inside the native (Capacitor) shell.
  if (isNative()) {
    return <Navigate to="/" replace />
  }

  const s = LANDING_STRINGS[lang]
  const goToLogin = () => navigate('/login')

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang === 'es' ? 'es' : 'en',
    mainEntity: s.faq.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div style={{ background: COLORS.cream, color: COLORS.ink, minHeight: '100%' }}>
      <Header s={s} lang={lang} setLang={setLang} desktop={desktop} onLogin={goToLogin} />
      <main>
        <Hero s={s} desktop={desktop} />
        <Manifest s={s} desktop={desktop} />
        <How s={s} desktop={desktop} />
        <Features s={s} desktop={desktop} />
        <Cases s={s} desktop={desktop} />
        <FAQ s={s} desktop={desktop} />
        <CTA s={s} desktop={desktop} />
      </main>
      <Footer s={s} desktop={desktop} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
