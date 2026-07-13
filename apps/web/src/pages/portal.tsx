import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressIndicator } from '@/components/status';
import { useToast } from '@/components/toast';
import { type DocumentRequestView, subcontractorApi } from '@/lib/subcontractors';

function UploadZone({ token, request }: { token: string; request: DocumentRequestView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
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
    choose(event.dataTransfer.files.item(0) ?? undefined);
  };
  const change = (event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0]);

  return <div className="space-y-2">
    <div
      className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground"
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
    >
      <p>Drag a PDF or image here, or choose a file.</p>
      <input ref={input} className="sr-only" type="file" accept="application/pdf,image/*" onChange={change} />
      <Button className="mt-3" type="button" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
        {upload.isPending ? 'Uploading…' : 'Choose file'}
      </Button>
      <p className="mt-2 text-xs">Maximum size: 10 MB</p>
    </div>
    {message && <p className={upload.isError ? 'text-sm text-destructive' : 'text-sm text-emerald-700'}>{message}</p>}
  </div>;
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
  if (portal.isLoading) return <main className="p-12 text-muted-foreground">Loading your document requests…</main>;
  if (portal.isError || !portal.data) return <main className="p-12">This portal link is invalid or has expired.</main>;
  const sub = portal.data.subcontractor;
  return <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-12"><header><p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Tough Leaf compliance portal</p><h1 className="mt-2 text-3xl font-semibold">Documents for {sub.name}</h1><p className="mt-2 text-muted-foreground">Please submit each requested document by its due date.</p></header><section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sub.documentRequests.sort((a,b) => a.documentType.sortOrder-b.documentType.sortOrder).map((request) => <Card key={request.id}><CardHeader><CardTitle>{request.documentType.name}</CardTitle><CardDescription>{request.documentType.description}</CardDescription></CardHeader><CardContent className="space-y-5"><UploadZone token={token} request={request} /><p className="text-sm">Due date: {request.dueDate ?? 'Not set'}</p><ProgressIndicator request={request} />{request.incompleteReason && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-medium">Action needed</p><p className="mt-1">{request.incompleteReason}</p></div>}</CardContent></Card>)}</section></main>;
}
