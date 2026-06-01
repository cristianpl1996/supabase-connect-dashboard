import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepsProgressProps {
  steps: string[];
  step: number;
  progress: number;
  label: string;
}

export function StepsProgress({ steps, step, progress, label }: StepsProgressProps) {
  return (
    <>
      <style>{`
        @keyframes promo-stripes { from { background-position: 28px 0; } to { background-position: 0 0; } }
        .promo-progress-bar {
          background-image: repeating-linear-gradient(45deg, #1a5c38 0px, #1a5c38 10px, #2d8653 10px, #2d8653 20px);
          background-size: 28px 28px;
          animation: promo-stripes 0.5s linear infinite;
        }
      `}</style>
      <div className="space-y-5 py-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted/60">
            <div className="promo-progress-bar h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 space-y-0">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-3 py-2">
                {done ? (
                  <CheckCircle2 className="size-6 shrink-0 text-primary" />
                ) : active ? (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-muted-foreground/20 text-[11px] font-bold text-muted-foreground/30">
                    {i + 1}
                  </div>
                )}
                <span className={cn(
                  'text-sm transition-all',
                  done && 'font-medium italic text-foreground',
                  active && 'font-semibold italic text-foreground',
                  !done && !active && 'text-muted-foreground/45',
                )}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
