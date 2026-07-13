import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { DOCUMENT_TYPE_META } from '@tl/shared';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

async function fetchHealth() {
  const res = await client.api.health.$get();
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export function HomePage() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Tough Leaf — RegTech demo
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Compliance Foundation</h1>
        <p className="text-muted-foreground">
          Monorepo scaffold is live: Vite + React SPA, Hono API, and a shared package with the
          document model — all wired through a typed RPC client.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {health.isLoading ? (
              <CircleDashed className="animate-spin text-muted-foreground" />
            ) : health.isError ? (
              <XCircle className="text-destructive" />
            ) : (
              <CheckCircle2 className="text-emerald-600" />
            )}
            API status
          </CardTitle>
          <CardDescription>
            Fetched from <code className="font-mono">/api/health</code> via the typed Hono client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {health.isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
          {health.isError && (
            <p className="text-sm text-destructive">
              API unreachable. Is the Hono server running on port 3000?
            </p>
          )}
          {health.data && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-mono">{health.data.status}</dd>
              <dt className="text-muted-foreground">Service</dt>
              <dd className="font-mono">{health.data.service}</dd>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="font-mono">{health.data.time}</dd>
            </dl>
          )}
          <Button variant="outline" size="sm" onClick={() => health.refetch()}>
            Re-check
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required documents</CardTitle>
          <CardDescription>
            {DOCUMENT_TYPE_META.length} document types from the shared package.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {DOCUMENT_TYPE_META.map((doc) => (
              <li key={doc.slug} className="flex items-center justify-between gap-4">
                <span>{doc.name}</span>
                <code className="font-mono text-xs text-muted-foreground">{doc.slug}</code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
