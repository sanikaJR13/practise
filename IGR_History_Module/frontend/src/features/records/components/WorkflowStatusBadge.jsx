import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  ShieldQuestion
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const STATUS_MAP = {
  completed: {
    tone: 'success',
    label: 'Completed',
    icon: CheckCircle2
  },
  partial: {
    tone: 'warning',
    label: 'Partial',
    icon: AlertTriangle
  },
  failed: {
    tone: 'warning',
    label: 'Failed',
    icon: AlertTriangle
  },
  captcha_pending: {
    tone: 'info',
    label: 'Captcha Pending',
    icon: CircleDashed
  },
  running: {
    tone: 'info',
    label: 'Running',
    icon: LoaderCircle
  }
}

export function WorkflowStatusBadge({ status, label, className }) {
  const config = STATUS_MAP[status] ?? {
    tone: 'neutral',
    label: label ?? 'Available',
    icon: ShieldQuestion
  }
  const Icon = config.icon

  return (
    <Badge tone={config.tone} className={className}>
      <Icon className={status === 'running' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
      {label ?? config.label}
    </Badge>
  )
}
