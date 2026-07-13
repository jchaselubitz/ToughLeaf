import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ProgressIndicator } from '@/components/status';
import { useToast } from '@/components/toast';
import { type DocumentRequestView, displayStatus, subcontractorApi } from '@/lib/subcontractors';

function EmailOnFile({ token, email }: { token: string; email: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email);
  useEffect(() => setValue(email), [email]);

  const save = useMutation({
    mutationFn: () => subcontractorApi.updatePortalEmail(token, value),
    onSuccess: () => {
      setEditing(false);
      toast({ message: 'Email updated.' });
      queryClient.invalidateQueries({ queryKey: ['portal', token] });
    },
    onError: (error) => {
      toast({ message: error instanceof Error ? error.message : 'Unable to update email.', tone: 'error' });
    },
  });

  if (!editing) {
    return <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Email on file: <span className="font-medium text-foreground">{email}</span></span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Update</Button>
    </div>;
  }

  return <form
    className="flex flex-wrap items-center gap-2"
    onSubmit={(event) => { event.preventDefault(); save.mutate(); }}
  >
    <input
      required
      type="email"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="min-w-0 rounded-md border bg-background px-2.5 py-1.5 text-sm"
      aria-label="Email on file"
    />
    <Button size="sm" type="submit" disabled={save.isPending || !value.trim()}>{save.isPending ? 'Saving…' : 'Save'}</Button>
    <Button size="sm" type="button" variant="ghost" disabled={save.isPending} onClick={() => { setEditing(false); setValue(email); }}>Cancel</Button>
  </form>;
}

function UploadZone({ token, request }: { token: string; request: DocumentRequestView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => subcontractorApi.upload(token, request.id, file),
    onSuccess: () => {
      setMessage('Document uploaded successfully.');
      toast({ message: `${request.documentType.name} uploaded successfully.` });
      queryClient.invalidateQueries({ queryKey: ['portal', token] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setMessage(message);
      toast({ message, tone: 'error' });
    },
  });
  const choose = (file?: File) => {
    if (!file) return;
    setMessage(undefined);
    upload.mutate(file);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    choose(event.dataTransfer.files.item(0) ?? undefined);
  };
  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };
  const change = (event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0]);

  const status = displayStatus(request);
  const awaitingApproval = status === 'submitted';
  const uploadedFile = request.versions[0];

  return <Card
    className={`gap-0 overflow-hidden py-0 shadow-sm transition-colors ${
      isDragging
        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
        : awaitingApproval
          ? 'border-border/50 bg-muted/40'
          : 'border-border/80 bg-card'
    }`}
    onDragOver={dragOver}
    onDragLeave={() => setIsDragging(false)}
    onDrop={drop}
  >
    <div className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${awaitingApproval ? 'opacity-90' : ''}`}>
      <div className="min-w-0 space-y-1.5">
        <CardTitle className="text-base">{request.documentType.name}</CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">{request.documentType.description}</CardDescription>
        <p className="pt-1 text-sm font-semibold text-foreground">
          Due date: <span className={status === 'overdue' ? 'text-red-700' : 'text-foreground'}>{request.dueDate ?? 'Not set'}</span>
        </p>
        {uploadedFile && <p className="flex items-center gap-1.5 pt-1 text-sm text-foreground">
          <span aria-hidden className="text-emerald-600">✓</span>
          You uploaded <span className="font-medium">{uploadedFile.filename}</span>
        </p>}
        <input ref={input} className="sr-only" type="file" accept="application/pdf,image/*" onChange={change} />
        {message && <p className={upload.isError ? 'pt-1 text-sm text-destructive' : 'pt-1 text-sm text-emerald-700'}>{message}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
        <Button className="w-full sm:w-auto" type="button" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? 'Uploading…' : uploadedFile ? 'Change file' : 'Choose file'}
        </Button>
        <p className="text-center text-xs text-muted-foreground sm:text-right">Drop a PDF or image anywhere on this card<br />Maximum size: 10 MB</p>
      </div>
    </div>
    {request.incompleteReason && <div className="mx-5 mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
      <p className="font-medium">Action needed</p>
      <p className="mt-1">{request.incompleteReason}</p>
    </div>}
    <div className="border-t bg-muted/30 px-5 py-4 sm:px-6">
      <ProgressIndicator request={request} />
    </div>
  </Card>;
}

export function PortalPage() {
  const { token = '' } = useParams();
  const portal = useQuery({ queryKey: ['portal', token], queryFn: () => subcontractorApi.portal(token) });
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const meta = existing ?? document.createElement('meta');
    const previousContent = existing?.content;
    if (!existing) {
      meta.name = 'robots';
      document.head.append(meta);
    }
    meta.content = 'noindex, nofollow, noarchive';
    return () => {
      if (existing) meta.content = previousContent ?? '';
      else meta.remove();
    };
  }, []);
  if (portal.isLoading) return <main className="min-h-screen bg-muted/40 p-12 text-muted-foreground">Loading your document requests…</main>;
  if (portal.isError || !portal.data) return <main className="min-h-screen bg-muted/40 p-12">This portal link is invalid or has expired.</main>;
  const sub = portal.data.subcontractor;
  return <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-4xl space-y-7"><header><p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Tough Leaf compliance portal</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Documents for {sub.name}</h1><p className="mt-2 text-muted-foreground">Please submit each requested document by its due date.</p><div className="mt-3"><EmailOnFile token={token} email={sub.email} /></div></header><section className="grid grid-cols-1 gap-4">{sub.documentRequests.sort((a,b) => a.documentType.sortOrder-b.documentType.sortOrder).map((request) => <UploadZone key={request.id} token={token} request={request} />)}</section></div></main>;
}
