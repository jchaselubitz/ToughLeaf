import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailPreview } from '@/components/email-preview';
import { StatusChip } from '@/components/status';
import { useToast } from '@/components/toast';
import { type EmailLogView, subcontractorApi } from '@/lib/subcontractors';

export function DashboardPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EmailLogView>();
  const [emailNotice, setEmailNotice] = useState<{ message: string; error?: boolean }>();
  const list = useQuery({ queryKey: ['subcontractors'], queryFn: subcontractorApi.list });
  const create = useMutation({
    mutationFn: subcontractorApi.create,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      setPreview(result.email?.preview ? result.email.log : undefined);
      setEmailNotice(result.emailError ? { message: result.emailError, error: true } : result.email ? { message: result.email.preview ? 'Initial request logged in preview mode.' : 'Initial request sent through Resend.' } : undefined);
      setOpen(false);
      toast({ message: result.emailError ? 'Subcontractor added, but the email could not be sent.' : 'Subcontractor added successfully.', tone: result.emailError ? 'error' : 'success' });
    },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to add the subcontractor.', tone: 'error' }),
  });
  const followUp = useMutation({
    mutationFn: subcontractorApi.sendFollowUp,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      setPreview(result.email.preview ? result.email.log : undefined);
      setEmailNotice({ message: result.email.preview ? 'Follow-up logged in preview mode.' : 'Follow-up sent through Resend.' });
      toast({ message: result.email.preview ? 'Follow-up saved in preview mode.' : 'Follow-up email sent.' });
    },
    onError: (error) => toast({ message: error instanceof Error ? error.message : 'Unable to send the follow-up.', tone: 'error' }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sendInitialEmail = window.confirm('Send the initial document request email now?');
    create.mutate({ name: String(form.get('name')), email: String(form.get('email')), dueDate: String(form.get('dueDate')), sendInitialEmail });
  }

  return <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-12">
    <header className="flex items-start justify-between gap-4">
      <div><p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Tough Leaf</p><h1 className="mt-2 text-3xl font-semibold">Subcontractor compliance</h1><p className="mt-2 text-muted-foreground">Track document requests and review progress.</p></div>
      <div className="flex gap-2"><Button variant="outline" asChild><Link to="/settings">Review settings</Link></Button><Button onClick={() => setOpen(true)}><Plus /> Add subcontractor</Button></div>
    </header>
    {emailNotice && <p className={emailNotice.error ? 'text-sm text-destructive' : 'text-sm text-emerald-700'}>{emailNotice.message}</p>}
    {preview && <EmailPreview email={preview} />}
    {open && <Card><CardHeader><CardTitle>Add subcontractor</CardTitle><CardDescription>Every required document will use this due date. You will be asked whether to send the initial request email.</CardDescription></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-4" onSubmit={submit}><input required name="name" placeholder="Company name" className="rounded-md border px-3 py-2" /><input required name="email" type="email" placeholder="email@company.com" className="rounded-md border px-3 py-2" /><input required name="dueDate" type="date" className="rounded-md border px-3 py-2" /><Button disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add'}</Button></form>{create.error && <p className="mt-3 text-sm text-destructive">{create.error.message}</p>}</CardContent></Card>}
    {list.isLoading && <p className="text-muted-foreground">Loading subcontractors…</p>}
    {list.data?.subcontractors.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No subcontractors yet. Add one to start collecting documents.</CardContent></Card>}
    {list.data && <section className="grid gap-4 md:grid-cols-2">{list.data.subcontractors.map((sub) => <Card key={sub.id} className="h-full"><CardHeader><CardTitle><Link className="hover:underline" to={`/subcontractors/${sub.id}`}>{sub.name}</Link></CardTitle><CardDescription>{sub.email}</CardDescription></CardHeader><CardContent className="space-y-3">{sub.documentRequests.sort((a, b) => a.documentType.sortOrder - b.documentType.sortOrder).map((request) => <div key={request.id} className="flex items-center justify-between gap-3 text-sm"><span>{request.documentType.name}</span><StatusChip request={request} /></div>)}<Button size="sm" variant="outline" disabled={followUp.isPending} onClick={() => followUp.mutate(sub.id)}>{followUp.isPending ? 'Sending…' : 'Send follow-up'}</Button>{followUp.isError && followUp.variables === sub.id && <p className="text-sm text-destructive">{followUp.error.message}</p>}</CardContent></Card>)}</section>}
  </main>;
}
