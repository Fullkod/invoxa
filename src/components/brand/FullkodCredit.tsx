// "Desarrollado por Fullkod" (CREA0004): the same credit on every screen.
export function FullkodCredit({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://fullkod.com/?ref=invoxa"
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-text-sec ${className}`}
    >
      Desarrollado por
      <img src="/brand/fullkod-symbol.svg" alt="" className="h-3 w-3" />
      <span className="font-semibold text-text-sec">Fullkod</span>
    </a>
  )
}
