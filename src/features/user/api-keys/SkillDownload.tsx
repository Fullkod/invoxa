import { Check, Copy, Download, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
// Single source of truth: the same skill the repo ships for Claude Code
// (twin copy for Codex in plugins/titan-factory-codex/skills/invoxa/).
import skillMarkdown from '../../../../.claude/skills/invoxa/SKILL.md?raw'

/**
 * Lets a developer download the `invoxa` skill so their agent (Claude Code,
 * Codex) knows how to talk to agent-api with their personal key.
 */
export function SkillDownload() {
  const [copied, setCopied] = useState(false)

  const download = () => {
    const url = URL.createObjectURL(new Blob([skillMarkdown], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'SKILL.md'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(skillMarkdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-xl border border-border px-3.5 py-3 text-xs text-text-sec">
      <p className="flex items-center gap-1.5 font-semibold text-text">
        <Sparkles size={14} className="text-primary" /> Skill para tu agente
      </p>
      <p className="mt-1">
        Enséñale a Claude Code o Codex a usar esta API: descarga el skill <code>invoxa</code> y
        guárdalo como <code>SKILL.md</code> en una carpeta <code>invoxa</code>:
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        <li>
          Claude Code: <code>~/.claude/skills/invoxa/</code> (para todos tus repos) o{' '}
          <code>.claude/skills/invoxa/</code> en un repo.
        </li>
        <li>
          Codex: <code>~/.codex/skills/invoxa/</code> o <code>.agents/skills/invoxa/</code> en un repo.
        </li>
      </ul>
      <p className="mt-1.5">
        Luego pon tu key en el <code>.env.local</code> del repo como <code>INVOXA_API_KEY</code> y pídele
        &quot;registra 2 h en …&quot;.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" leftIcon={<Download size={14} />} onClick={download}>
          Descargar SKILL.md
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
          onClick={() => void copy()}
        >
          {copied ? 'Copiado' : 'Copiar contenido'}
        </Button>
      </div>
    </div>
  )
}
