import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ClipboardList, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/toast';
import { settingsApi, type SettingsDocumentTypeView } from '@/lib/subcontractors';
import { cn } from '@/lib/utils';

function RequirementRow({ documentTypeId, requirement }: { documentTypeId: string; requirement: SettingsDocumentTypeView['requirements'][number] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState(requirement.text);
  useEffect(() => setText(requirement.text), [requirement.text]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['settings'] });
  const save = useMutation({ mutationFn: () => settingsApi.updateRequirement(documentTypeId, requirement.id, text), onSuccess: () => { refresh(); toast({ message: 'Requirement saved.' }); }, onError: () => toast({ message: 'Unable to save the requirement.', tone: 'error' }) });
  const remove = useMutation({ mutationFn: () => settingsApi.deleteRequirement(documentTypeId, requirement.id), onSuccess: () => { refresh(); toast({ message: 'Requirement removed.' }); }, onError: () => toast({ message: 'Unable to remove the requirement.', tone: 'error' }) });

  return <div className="flex gap-2">
    <input className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm" value={text} onChange={(event) => setText(event.target.value)} aria-label="Requirement" />
    <Button size="sm" variant="outline" disabled={save.isPending || !text.trim()} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</Button>
    <Button size="icon-sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()} aria-label="Remove requirement"><Minus /></Button>
  </div>;
}

function DocumentTypeSettings({ documentType }: { documentType: SettingsDocumentTypeView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState(documentType.settings?.additionalInstructions ?? '');
  const [newRequirement, setNewRequirement] = useState('');
  useEffect(() => setInstructions(documentType.settings?.additionalInstructions ?? ''), [documentType.settings?.additionalInstructions]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['settings'] });
  const saveInstructions = useMutation({ mutationFn: () => settingsApi.updateInstructions(documentType.id, instructions), onSuccess: () => { refresh(); toast({ message: 'AI instructions saved.' }); }, onError: () => toast({ message: 'Unable to save AI instructions.', tone: 'error' }) });
  const addRequirement = useMutation({ mutationFn: () => settingsApi.addRequirement(documentType.id, newRequirement), onSuccess: () => { setNewRequirement(''); refresh(); toast({ message: 'Requirement added.' }); }, onError: () => toast({ message: 'Unable to add the requirement.', tone: 'error' }) });

  return <section className="space-y-4 border-b pb-6 last:border-0 last:pb-0">
    <div><h3 className="font-medium">{documentType.name}</h3><p className="mt-1 text-sm text-muted-foreground">{documentType.description}</p></div>
    <div><label className="text-sm font-medium" htmlFor={`${documentType.id}-instructions`}>Additional AI instructions</label>
      <textarea id={`${documentType.id}-instructions`} className="mt-2 min-h-20 w-full resize-y rounded-md border bg-background p-2.5 text-sm" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Add document-specific guidance for the AI reviewer." />
      <Button className="mt-2" size="sm" disabled={saveInstructions.isPending} onClick={() => saveInstructions.mutate()}>{saveInstructions.isPending ? 'Saving…' : 'Save instructions'}</Button>
    </div>
    <div className="space-y-2"><p className="text-sm font-medium">Requirements</p>
      {documentType.requirements.map((requirement) => <RequirementRow key={requirement.id} documentTypeId={documentType.id} requirement={requirement} />)}
      <div className="flex gap-2 pt-1"><input className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm" value={newRequirement} onChange={(event) => setNewRequirement(event.target.value)} placeholder="New requirement" />
        <Button size="sm" disabled={addRequirement.isPending || !newRequirement.trim()} onClick={() => addRequirement.mutate()}><Plus /> Add</Button>
      </div>
    </div>
  </section>;
}

function DocumentRequirements() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.list });
  if (settings.isLoading) return <p className="text-sm text-muted-foreground">Loading document requirements…</p>;
  if (settings.isError || !settings.data) return <p className="text-sm text-destructive">Unable to load document requirements.</p>;
  return <div className="space-y-6">{settings.data.documentTypes.map((documentType) => <DocumentTypeSettings key={documentType.id} documentType={documentType} />)}</div>;
}

const pages = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'requirements', label: 'Document Requirements', icon: ClipboardList },
] as const;

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [page, setPage] = useState<(typeof pages)[number]['id']>('requirements');
  const currentPage = pages.find((item) => item.id === page)!;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[min(860px,calc(100dvh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-5xl" showCloseButton>
      <DialogTitle className="sr-only">Settings</DialogTitle>
      <DialogDescription className="sr-only">Manage notifications and document requirements.</DialogDescription>
      <div className="flex min-h-0 flex-col md:flex-row">
        <nav aria-label="Settings pages" className="shrink-0 border-b bg-muted/30 p-3 md:w-52 md:border-r md:border-b-0">
          <p className="px-2 pb-2 text-sm font-semibold">Settings</p>
          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {pages.map((item) => <button key={item.id} type="button" onClick={() => setPage(item.id)} className={cn('flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent', page === item.id && 'bg-accent font-medium')}>
              <item.icon className="size-4" /><span>{item.label}</span>
            </button>)}
          </div>
        </nav>
        <main className="flex h-[min(760px,calc(100dvh-7rem))] min-w-0 flex-1 flex-col">
          <header className="border-b px-5 py-4"><p className="text-sm text-muted-foreground">Settings</p><h2 className="text-lg font-semibold">{currentPage.label}</h2></header>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {page === 'notifications' ? <p className="text-sm text-muted-foreground">Notification settings are coming soon.</p> : <DocumentRequirements />}
          </div>
        </main>
      </div>
    </DialogContent>
  </Dialog>;
}
