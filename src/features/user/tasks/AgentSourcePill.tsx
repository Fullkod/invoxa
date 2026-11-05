import { Bot } from 'lucide-react'
import { Pill } from '../../../components/ui/Pill'
import type { TaskSource } from '../../../types/task'

/** Discreet marker for tasks registered through the agent API (PRP-002). */
export function AgentSourcePill({ source }: { source: TaskSource | undefined }) {
  if (source !== 'api') return null
  return (
    <span title="Registrada por un agente (API)">
      <Pill tone="blue">
        <Bot size={10} className="inline" /> Agente
      </Pill>
    </span>
  )
}
