import type { EmailLogView } from '@/lib/subcontractors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EmailPreview({ email }: { email: EmailLogView }) {
  return <Card className="border-amber-300 bg-amber-50/40">
    <CardHeader>
      <CardTitle className="text-base">Email preview</CardTitle>
      <p className="text-sm text-muted-foreground">Preview mode is active — this message was logged but not delivered.</p>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm"><span className="font-medium">To:</span> {email.toEmail}</p>
      <p className="text-sm"><span className="font-medium">Subject:</span> {email.subject}</p>
      <iframe title={`Preview: ${email.subject}`} sandbox="" srcDoc={email.previewHtml} className="h-80 w-full rounded border bg-white" />
    </CardContent>
  </Card>;
}
