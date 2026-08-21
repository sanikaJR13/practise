import { AlertTriangle, Clock3, Sparkles, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const ICONS = {
  neutral: Sparkles,
  info: Clock3,
  warning: AlertTriangle,
  success: UsersRound
};

const STYLES = {
  neutral: 'border-[#dde5ef] bg-white',
  info: 'border-[#dce7f2] bg-[#f4f8fc]',
  warning: 'border-[#f0ddbc] bg-[#fff8ea]',
  success: 'border-[#dce7f2] bg-[#f2f7fb]'
};

export function RegistryObservationCard({ observation }) {
  const Icon = ICONS[observation.tone] ?? ICONS.neutral;

  return (
    <div className={cn('rounded-[1.35rem] border p-4', STYLES[observation.tone] ?? STYLES.neutral)}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white/90 p-2 text-[#29425f]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#132033]">{observation.title}</p>
          <p className="mt-2 text-sm leading-7 text-[#5f6c80]">{observation.description}</p>
        </div>
      </div>
    </div>
  );
}
