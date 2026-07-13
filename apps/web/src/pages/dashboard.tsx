import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SubcontractorCard } from '@/components/subcontractor-card';
import { subcontractorApi } from '@/lib/subcontractors';

export function DashboardPage() {
  const list = useQuery({ queryKey: ['subcontractors'], queryFn: subcontractorApi.list });

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
            <SubcontractorCard key={sub.id} subcontractor={sub} />
          ))}
        </section>
      )}
    </div>
  );
}
