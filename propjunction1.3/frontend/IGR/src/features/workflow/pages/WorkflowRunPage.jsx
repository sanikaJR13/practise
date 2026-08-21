import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Loader2, Play, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api/api-client';
import { normalizeWorkflow } from '@/lib/api/adapters';
import { cn } from '@/lib/utils/cn';

export function WorkflowRunPage() {
  const { runId } = useParams();
  const [isPolling, setIsPolling] = useState(true);

  // Poll workflow run status
  const workflowQuery = useQuery({
    queryKey: ['workflows', runId],
    queryFn: () => apiClient.get(`workflows/${runId}/`),
    select: normalizeWorkflow,
    refetchInterval: isPolling ? 2500 : false
  });

  const wf = workflowQuery.data;

  // Stop polling when done
  useEffect(() => {
    if (wf && ['completed', 'failed', 'partial'].includes(wf.status)) {
      setIsPolling(false);
    }
  }, [wf]);

  const firstCompletedRun = useMemo(() => {
    if (!wf || !wf.sourceRuns) return null;
    return wf.sourceRuns.find(run => run.status === 'completed');
  }, [wf]);

  const progressPercent = useMemo(() => {
    if (!wf || !wf.total_steps) return 0;
    return Math.round((wf.completed_steps / wf.total_steps) * 100);
  }, [wf]);

  if (workflowQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (workflowQuery.isError) {
    return (
      <div className="mx-auto max-w-[800px] p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-error mx-auto" />
        <h2 className="text-xl font-bold text-primary">Error Loading Workflow</h2>
        <p className="text-on-surface-variant text-sm">{workflowQuery.error.message}</p>
        <Link to="/"><Button tone="primary">Back to Search</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-7 px-4 py-8">
      {/* Page Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6 border-outline-variant/10">
        <div>
          <p className="section-eyebrow">Scraper Progress Monitor</p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-primary mt-1">
            Running IGR History Scraper
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Target Property: <span className="font-bold text-primary">{wf.subjectLabel}</span> ({wf.district}, {wf.taluka}, {wf.village})
          </p>
          <p className="text-on-surface-variant text-sm mt-0.5">
            Year range: <span className="font-semibold text-primary">{wf.year_from} - {wf.year_to}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {firstCompletedRun && (
            <Link to={`/records/igr/${firstCompletedRun.id}`}>
              <Button tone="primary" className="py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm">
                <Play className="h-3 w-3" />
                View Combined Results So Far
              </Button>
            </Link>
          )}
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
            wf.status === 'completed' && "bg-green-50 text-green-700 border-green-200",
            wf.status === 'running' && "bg-blue-50 text-blue-700 border-blue-200",
            wf.status === 'failed' && "bg-red-50 text-red-700 border-red-200",
            wf.status === 'pending' && "bg-surface-container-high text-primary border-outline-variant/30"
          )}>
            {wf.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
            {wf.status.toUpperCase()}
          </span>
        </div>
      </section>

      {/* Progress Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 bg-white border-outline-variant/20 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Overall Completion</p>
            <h3 className="text-4xl font-black text-primary mt-2">{progressPercent}%</h3>
          </div>
          <div className="w-full bg-surface-container rounded-full h-2.5 mt-4 overflow-hidden border border-outline-variant/15">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>

        <Card className="p-6 bg-white border-outline-variant/20">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Completed / Total Years</p>
          <h3 className="text-4xl font-black text-primary mt-2">
            {wf.completed_steps} <span className="text-lg text-on-surface-variant font-medium">/ {wf.total_steps}</span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-4">
            {isPolling ? 'Scraping years concurrently...' : 'Finished execution pipeline.'}
          </p>
        </Card>

        <Card className="p-6 bg-white border-outline-variant/20 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">OCR Accuracy Status</p>
            <h3 className="text-xl font-bold text-primary mt-2">CAPTCHA Solver</h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Solving CAPTCHA challenges dynamically using Tesseract OCR with automatic retry attempts.
          </p>
        </Card>
      </div>

      {/* Sequenced Year Runs List */}
      <Card className="p-6 bg-white border-outline-variant/20 rounded-[2rem]">
        <h2 className="font-headline text-xl font-bold text-primary mb-4 border-b pb-3 border-outline-variant/10">
          Yearly Extraction Pipeline
        </h2>

        <div className="divide-y divide-outline-variant/10">
          {wf.sourceRuns.map((run) => {
            const isCompleted = run.status === 'completed';
            const isFailed = run.status === 'failed';
            
            return (
              <div key={run.id} className="py-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl border flex items-center justify-center",
                    isCompleted && "bg-green-50 text-green-700 border-green-100",
                    isFailed && "bg-red-50 text-red-700 border-red-100",
                    !isCompleted && !isFailed && "bg-blue-50 text-blue-700 border-blue-100"
                  )}>
                    {run.status === 'running' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <CircleDashed className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-primary text-base">Year {run.year}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {isCompleted 
                        ? `Scraped ${run.result?.transaction_count ?? 0} transactions.` 
                        : isFailed 
                          ? `Failed: ${run.errorMessage || 'Unknown error'}` 
                          : 'Scraper in queue...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isCompleted && (
                    <Link to={`/records/igr/${run.id}`}>
                      <Button tone="neutral" className="py-2 px-4 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm border border-outline-variant/20 bg-surface">
                        <Play className="h-3 w-3 text-secondary" />
                        Inspect Year Forensics
                      </Button>
                    </Link>
                  )}
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-md border",
                    isCompleted && "bg-green-50 border-green-200 text-green-600",
                    isFailed && "bg-red-50 border-red-200 text-red-600",
                    !isCompleted && !isFailed && "bg-surface border-outline-variant text-on-surface-variant"
                  )}>
                    {run.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
