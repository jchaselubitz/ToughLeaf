import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { type FormEvent, useEffect, useState } from 'react';
import type { ReviewResult } from '@tl/shared';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/status';
import { EmailPreview } from '@/components/email-preview';
import { useToast } from '@/components/toast';
import {
  type DocumentRequestView,
  type DocumentVersionView,
  type EmailLogView,
  subcontractorApi,
} from '@/lib/subcontractors';

function seededReview(request: DocumentRequestView, version: DocumentVersionView): ReviewResult {
  const existing = version.humanReview;
  const aiResults = new Map(version.aiReview?.results.map((result) => [result.requirement_id, result]));
  const existingResults = new Map(existing?.results.map((result) => [result.requirement_id, result]));
  return {
    ...existing,
    reason: existing?.reason ?? version.aiReview?.results.find((result) => !result.pass && result.reason?.trim())?.reason ?? '',
    results: request.documentType.requirements.map((requirement) => {
      const previous = existingResults.get(requirement.id);
      const aiResult = aiResults.get(requirement.id);
      return {
        requirement_id: requirement.id,
        requirement: requirement.text,
        pass: previous?.pass ?? aiResult?.pass ?? true,
        reason: previous?.reason ?? aiResult?.reason ?? '',
      };
    }),
  };
}

function certificateExpiry(version: DocumentVersionView) {
  const expiryDate = version.extracted?.expiry_date;
  if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  if (expiryDate < today) return { expiryDate, label: 'Expired', className: 'text-destructive' };
  const days = Math.ceil((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= 30 ? { expiryDate, label: `Expiring in ${days} days`, className: 'text-amber-700' } : { expiryDate, label: 'Current', className: 'text-emerald-700' };
}

function AiReview({ request, version, onRerun, isRerunning }: {
  request: DocumentRequestView;
  version: DocumentVersionView;
  onRerun: () => void;
  isRerunning: boolean;
}) {
  const expiry = request.documentType.id === 'insurance_certificate' && request.status === 'accepted' ? certificateExpiry(version) : undefined;
  return <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-medium text-blue-950">AI-generated review</p><p className="text-xs text-blue-800">Advisory only — confirm or correct every result before deciding.</p></div>
      <Button size="sm" variant="outline" disabled={isRerunning} onClick={onRerun}>{isRerunning ? 'Queueing…' : 'Re-run AI review'}</Button>
    </div>
    {version.aiReview && <>
      {version.aiReview.summary && <p className="text-sm text-blue-950">{version.aiReview.summary}</p>}
      <ul className="space-y-2">{version.aiReview.results.map((result) => <li className="rounded border border-blue-100 bg-white p-2 text-sm" key={result.requirement_id}>
        <span className={result.pass ? 'font-medium text-emerald-700' : 'font-medium text-destructive'}>{result.pass ? 'Pass' : 'Needs correction'}</span><span className="ml-2">{result.requirement}</span>
        {!result.pass && result.reason && <p className="mt-1 text-muted-foreground">{result.reason}</p>}
      </li>)}</ul>
    </>}
    {!version.aiReview && !version.aiReviewError && <p className="text-sm text-blue-800">AI review is running… this card refreshes automatically.</p>}
    {version.aiReviewError && <p className="text-sm text-destructive">{version.aiReviewError}</p>}
    {expiry && <p className={`text-sm font-medium ${expiry.className}`}>COI expiration: {expiry.expiryDate} · {expiry.label}</p>}
  </div>;
}

function DocumentReview({
  request,
  version,
  onSave,
  isSaving,
  error,
}: {
  request: DocumentRequestView;
  version: DocumentVersionView;
  onSave: (input: { status: 'accepted' | 'incomplete'; humanReview: ReviewResult }) => void;
  isSaving: boolean;
  error?: string;
}) {
  const [review, setReview] = useState(() => seededReview(request, version));

  useEffect(() => setReview(seededReview(request, version)), [request, version]);

  function updateResult(index: number, patch: Partial<ReviewResult['results'][number]>) {
    setReview((current) => ({
      ...current,
      results: current.results.map((result, currentIndex) => currentIndex === index ? { ...result, ...patch } : result),
    }));
  }

  const canMarkIncomplete = Boolean(review.reason?.trim())
    || review.results.some((result) => !result.pass && result.reason?.trim());

  return <div className="space-y-4 border-t pt-4">
    <div>
      <p className="text-sm font-medium">Human review</p>
      <p className="text-xs text-muted-foreground">Record corrections for each requirement before making the decision.</p>
    </div>
    <div className="space-y-3">
      {review.results.map((result, index) => <div className="rounded-md border p-3" key={result.requirement_id}>
        <label className="block text-sm font-medium" htmlFor={`${version.id}-${result.requirement_id}-status`}>{result.requirement}</label>
        <select
          id={`${version.id}-${result.requirement_id}-status`}
          className="mt-2 rounded-md border px-2 py-1 text-sm"
          value={result.pass ? 'pass' : 'fail'}
          onChange={(event) => updateResult(index, { pass: event.target.value === 'pass' })}
        >
          <option value="pass">Pass</option>
          <option value="fail">Needs correction</option>
        </select>
        {!result.pass && <textarea
          className="mt-2 min-h-16 w-full rounded-md border p-2 text-sm"
          placeholder="What is missing or needs correction?"
          value={result.reason ?? ''}
          onChange={(event) => updateResult(index, { reason: event.target.value })}
        />}
      </div>)}
    </div>
    <div>
      <label className="text-sm font-medium" htmlFor={`${version.id}-incomplete-reason`}>Message to subcontractor</label>
      <textarea
        id={`${version.id}-incomplete-reason`}
        className="mt-2 min-h-20 w-full rounded-md border p-2 text-sm"
        placeholder="Required when marking incomplete; shown in the portal."
        value={review.reason ?? ''}
        onChange={(event) => setReview((current) => ({ ...current, reason: event.target.value }))}
      />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button disabled={isSaving} onClick={() => onSave({ status: 'accepted', humanReview: review })}>
        {isSaving ? 'Saving…' : 'Mark accepted'}
      </Button>
      <Button variant="outline" disabled={isSaving || !canMarkIncomplete} onClick={() => onSave({ status: 'incomplete', humanReview: review })}>
        Mark incomplete
      </Button>
    </div>
    {!canMarkIncomplete && <p className="text-xs text-muted-foreground">Add a portal message or a failed-requirement reason to mark this document incomplete.</p>}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>;
}

export function SubcontractorPage() {
  const toast = useToast();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['subcontractor', id], queryFn: () => subcontractorApi.get(id) });
  const sub = detail.data?.subcontractor;
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<EmailLogView>();
  useEffect(() => setNote(sub?.note ?? ''), [sub?.note]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['subcontractor', id] });
  const save = useMutation({
    mutationFn: (input: { name: string; email: string; dueDate: string }) => subcontractorApi.update(id, input),
    onSuccess: () => { refresh(); toast({ message: 'Subcontractor details saved.' }); },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to save changes.', tone: 'error' }),
  });
  const saveNote = useMutation({
    mutationFn: () => subcontractorApi.updateNote(id, note),
    onSuccess: () => { refresh(); toast({ message: 'Internal note saved.' }); },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to save the note.', tone: 'error' }),
  });
  const download = useMutation({
    mutationFn: (input: { requestId: string; versionId: string }) => subcontractorApi.download(id, input.requestId, input.versionId),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const review = useMutation({
    mutationFn: (input: { requestId: string; status: 'accepted' | 'incomplete'; humanReview: ReviewResult }) =>
      subcontractorApi.review(id, input.requestId, { status: input.status, humanReview: input.humanReview }),
    onSuccess: () => { refresh(); toast({ message: 'Document decision saved.' }); },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to save the review.', tone: 'error' }),
  });
  const rerunAiReview = useMutation({
    mutationFn: (input: { requestId: string; versionId: string }) => subcontractorApi.rerunAiReview(id, input.requestId, input.versionId),
    onSuccess: () => { refresh(); toast({ message: 'AI review queued.' }); },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to queue the AI review.', tone: 'error' }),
  });
  const followUp = useMutation({
    mutationFn: () => subcontractorApi.sendFollowUp(id),
    onSuccess: (result) => {
      setPreview(result.email.preview ? result.email.log : undefined);
      refresh();
      toast({ message: result.email.preview ? 'Follow-up saved in preview mode.' : 'Follow-up email sent.' });
    },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to send the follow-up.', tone: 'error' }),
  });
  const hasPendingAiReview = Boolean(sub?.documentRequests.some((request) => request.versions.some((version) => !version.aiReview && !version.aiReviewError)));
  useEffect(() => {
    if (!hasPendingAiReview) return undefined;
    const interval = window.setInterval(refresh, 2_000);
    return () => window.clearInterval(interval);
  }, [hasPendingAiReview, queryClient, id]);

  if (detail.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!sub) return <p>Subcontractor not found.</p>;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save.mutate({ name: String(form.get('name')), email: String(form.get('email')), dueDate: String(form.get('dueDate')) });
  }

  const dueDate = sub.documentRequests[0]?.dueDate ?? '';
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Link className="text-sm text-muted-foreground hover:underline" to="/">
        ← Dashboard
      </Link>
      <PageHeader
        title={sub.name}
        description={
          <a className="text-blue-700 underline" href={`/portal/${sub.portalToken}`} target="_blank" rel="noreferrer">
            Open subcontractor portal
          </a>
        }
        actions={
          <Button variant="outline" disabled={followUp.isPending} onClick={() => followUp.mutate()}>
            {followUp.isPending ? 'Sending…' : 'Send follow-up'}
          </Button>
        }
      />
    {followUp.isError && <p className="text-sm text-destructive">{followUp.error instanceof Error ? followUp.error.message : 'Unable to send the follow-up.'}</p>}
    {preview && <EmailPreview email={preview} />}
    <Card>
      <CardHeader><CardTitle>Subcontractor details</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-4" onSubmit={submit}>
          <input required name="name" defaultValue={sub.name} className="rounded-md border px-3 py-2" />
          <input required name="email" type="email" defaultValue={sub.email} className="rounded-md border px-3 py-2" />
          <input required name="dueDate" type="date" defaultValue={dueDate} className="rounded-md border px-3 py-2" />
          <Button disabled={save.isPending}>Save changes</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Changing the due date updates all non-accepted document requests.</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Internal note</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-28 w-full rounded-md border p-3" placeholder="Private note — not visible in the portal." />
        <Button onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>Save note</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Email history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {sub.emailLog.length === 0 ? <p className="text-sm text-muted-foreground">No document request emails have been sent.</p> : <ul className="space-y-3">{sub.emailLog.map((email) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm" key={email.id}><div><p className="font-medium">{email.kind === 'request' ? 'Initial request' : 'Follow-up'} · {email.subject}</p><p className="text-muted-foreground">To {email.toEmail} · {new Date(email.sentAt).toLocaleString()} · {email.resendId ? 'Delivered through Resend' : 'Preview only'}</p></div>{!email.resendId && <Button size="sm" variant="outline" onClick={() => setPreview(email)}>View preview</Button>}</li>)}</ul>}
      </CardContent>
    </Card>
    <section className="grid gap-3">
      {sub.documentRequests.sort((a, b) => a.documentType.sortOrder - b.documentType.sortOrder).map((request) => {
        const currentVersion = request.versions[0];
        return <Card key={request.id}>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{request.documentType.name}</p>
                <p className="text-sm text-muted-foreground">Due {request.dueDate ?? 'not set'}</p>
              </div>
              <StatusChip request={request} />
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Versions</p>
              {request.versions.length === 0 ? <p className="text-sm text-muted-foreground">No document uploaded yet.</p> : <ul className="space-y-2">
                {request.versions.map((version, index) => <li className="flex items-center justify-between gap-3 text-sm" key={version.id}>
                  <span><span className="font-medium">Version {request.versions.length - index}</span> · {version.filename} <span className="text-muted-foreground">({Math.ceil(version.sizeBytes / 1024)} KB)</span></span>
                  <Button size="sm" variant="outline" disabled={download.isPending} onClick={() => download.mutate({ requestId: request.id, versionId: version.id })}>{download.isPending ? 'Preparing…' : 'Download'}</Button>
                </li>)}
              </ul>}
              {download.isError && <p className="mt-2 text-sm text-destructive">Unable to prepare the download. Please try again.</p>}
            </div>
            {currentVersion && <AiReview
              request={request}
              version={currentVersion}
              isRerunning={rerunAiReview.isPending}
              onRerun={() => rerunAiReview.mutate({ requestId: request.id, versionId: currentVersion.id })}
            />}
            {currentVersion && <DocumentReview
              request={request}
              version={currentVersion}
              isSaving={review.isPending}
              error={review.isError ? (review.error instanceof Error ? review.error.message : 'Unable to save the review.') : undefined}
              onSave={(input) => review.mutate({ requestId: request.id, ...input })}
            />}
          </CardContent>
        </Card>;
      })}
    </section>
    </div>
  );
}
