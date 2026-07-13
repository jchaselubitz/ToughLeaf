import type { DocumentRequestView } from '@/lib/subcontractors';
import { displayStatus } from '@/lib/subcontractors';
import { cn } from '@/lib/utils';

const label: Record<string, string> = {
  requested: 'Requested', overdue: 'Overdue', submitted: 'Submitted', incomplete: 'Incomplete', accepted: 'Accepted',
};

export function StatusChip({ request }: { request: DocumentRequestView }) {
  const status = displayStatus(request);
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status === 'accepted' && 'bg-emerald-100 text-emerald-800', status === 'overdue' && 'bg-red-100 text-red-800', status === 'incomplete' && 'bg-red-100 text-red-800', status === 'submitted' && 'bg-blue-100 text-blue-800', status === 'requested' && 'bg-slate-100 text-slate-700')}>{label[status]}</span>;
}

export function ProgressIndicator({ request }: { request: DocumentRequestView }) {
  const status = displayStatus(request);
  const reached = status === 'accepted' ? 3 : status === 'submitted' || status === 'incomplete' ? 2 : 1;
  const color = status === 'accepted' ? 'bg-emerald-500' : status === 'overdue' || status === 'incomplete' ? 'bg-red-500' : 'bg-blue-500';
  return <div className="space-y-2"><div className="flex gap-1">{[1, 2, 3].map((step) => <span key={step} className={cn('h-2 flex-1 rounded-sm bg-slate-200', step <= reached && color)} />)}</div><p className={cn('text-xs font-medium', (status === 'overdue' || status === 'incomplete') && 'text-red-700')}>{label[status]}</p></div>;
}
