import { Pill } from '../../components/ui/Pill'
import { REVIEW_STATUS_LABEL, type ReviewStatus } from '../../types/supervision'

const TONE: Record<ReviewStatus, 'amber' | 'green' | 'violet'> = {
  pending: 'amber',
  approved: 'green',
  changes_proposed: 'violet',
}

export function ReviewStatusPill({ status }: { status: ReviewStatus }) {
  return <Pill tone={TONE[status]}>{REVIEW_STATUS_LABEL[status]}</Pill>
}
