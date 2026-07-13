import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type DocumentRequestView, type SubcontractorView } from '@/lib/subcontractors';

const SEEN_SUBMISSIONS_STORAGE_KEY = 'tl:seenSubmittedRequestIds';

function readSeenRequestIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_SUBMISSIONS_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Marks the given request ids as seen so their "new" badge won't reappear on this device. */
function markRequestIdsSeen(requestIds: string[]) {
  const seen = readSeenRequestIds();
  requestIds.forEach((id) => seen.add(id));
  window.localStorage.setItem(SEEN_SUBMISSIONS_STORAGE_KEY, JSON.stringify([...seen]));
}

function formatDueDate(value: string | null) {
  if (!value) return 'no due date set';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** Builds a mailto: link that opens the user's email app pre-populated with a follow-up. */
function buildFollowUpMailto(subcontractor: SubcontractorView, outstanding: DocumentRequestView[]) {
  const portalUrl = new URL(`/portal/${encodeURIComponent(subcontractor.portalToken)}`, window.location.origin).toString();
  const subject = 'Reminder: outstanding compliance documents';
  const documentLines = outstanding
    .map((request) => `- ${request.documentType.name} — due ${formatDueDate(request.dueDate)}`)
    .join('\n');
  const body = [
    `Hello ${subcontractor.name},`,
    '',
    'This is a reminder that the following compliance documents are still outstanding:',
    '',
    documentLines,
    '',
    `Open your document portal: ${portalUrl}`,
    '',
    'Thank you,',
    'Tough Leaf Compliance',
  ].join('\n');
  return `mailto:${encodeURIComponent(subcontractor.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SubcontractorCard({ subcontractor }: { subcontractor: SubcontractorView }) {
  const requests = [...subcontractor.documentRequests].sort(
    (a, b) => a.documentType.sortOrder - b.documentType.sortOrder,
  );
  const outstanding = requests.filter((request) => request.status !== 'accepted');
  const followUpHref = buildFollowUpMailto(subcontractor, outstanding);
  const submittedRequestIds = requests.filter((request) => request.status === 'submitted').map((request) => request.id);

  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(() => readSeenRequestIds());
  useEffect(() => {
    setSeenRequestIds(readSeenRequestIds());
  }, []);

  const newSubmissions = submittedRequestIds.filter((id) => !seenRequestIds.has(id)).length;

  function handleViewSubcontractor() {
    if (submittedRequestIds.length === 0) return;
    markRequestIdsSeen(submittedRequestIds);
    setSeenRequestIds(readSeenRequestIds());
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-xl tracking-tight sm:text-2xl">
          <Link
            className="hover:underline"
            to={`/subcontractors/${subcontractor.id}`}
            onClick={handleViewSubcontractor}
          >
            {subcontractor.name}
          </Link>
          {newSubmissions > 0 && (
            <Badge
              variant="default"
              className="mt-0.5 shrink-0 bg-blue-600 text-white"
              aria-label={`${newSubmissions} new document${newSubmissions === 1 ? '' : 's'} submitted`}
            >
              {newSubmissions} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{subcontractor.email}</CardDescription>
        {outstanding.length > 0 && (
          <Button asChild size="sm" variant="outline" className="mt-2 h-7 w-fit px-2 text-xs">
            <a href={followUpHref}>Send follow-up</a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{request.documentType.name}</span>
            <StatusChip request={request} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
