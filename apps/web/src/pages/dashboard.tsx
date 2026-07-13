import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailPreview } from '@/components/email-preview';
import { StatusChip } from '@/components/status';
import { useToast } from '@/components/toast';
import { type EmailLogView, subcontractorApi } from '@/lib/subcontractors';

export function DashboardPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<EmailLogView>();
  const [emailNotice, setEmailNotice] = useState<{ message: string; error?: boolean }>();
  const list = useQuery({ queryKey: ['subcontractors'], queryFn: subcontractorApi.list });
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

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Subcontractor compliance"
        description="Track document requests and review progress."
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings">Review settings</Link>
          </Button>
        }
      />
      {emailNotice && (
        <p className={emailNotice.error ? 'text-sm text-destructive' : 'text-sm text-emerald-700'}>
          {emailNotice.message}
        </p>
      )}
      {preview && <EmailPreview email={preview} />}
      {list.isLoading && <p className="text-muted-foreground">Loading subcontractors…</p>}
      {list.data?.subcontractors.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No subcontractors yet. Add one to start collecting documents.
          </CardContent>
        </Card>
      )}
      {list.data && (
        <section className="grid gap-4 md:grid-cols-2">
          {list.data.subcontractors.map((sub) => (
            <Card key={sub.id} className="h-full">
              <CardHeader>
                <CardTitle>
                  <Link className="hover:underline" to={`/subcontractors/${sub.id}`}>
                    {sub.name}
                  </Link>
                </CardTitle>
                <CardDescription>{sub.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sub.documentRequests
                  .sort((a, b) => a.documentType.sortOrder - b.documentType.sortOrder)
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{request.documentType.name}</span>
                      <StatusChip request={request} />
                    </div>
                  ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={followUp.isPending}
                  onClick={() => followUp.mutate(sub.id)}
                >
                  {followUp.isPending ? 'Sending…' : 'Send follow-up'}
                </Button>
                {followUp.isError && followUp.variables === sub.id && (
                  <p className="text-sm text-destructive">{followUp.error.message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
