import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/toast';
import { settingsApi, type SettingsDocumentTypeView } from '@/lib/subcontractors';

function RequirementRow({ documentTypeId, requirement }: { documentTypeId: string; requirement: SettingsDocumentTypeView['requirements'][number] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState(requirement.text);
  useEffect(() => setText(requirement.text), [requirement.text]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['settings'] });
  const save = useMutation({ mutationFn: () => settingsApi.updateRequirement(documentTypeId, requirement.id, text), onSuccess: () => { refresh(); toast({ message: 'Requirement saved.' }); }, onError: () => toast({ message: 'Unable to save the requirement.', tone: 'error' }) });
  const remove = useMutation({ mutationFn: () => settingsApi.deleteRequirement(documentTypeId, requirement.id), onSuccess: () => { refresh(); toast({ message: 'Requirement removed.' }); }, onError: () => toast({ message: 'Unable to remove the requirement.', tone: 'error' }) });
  return <div className="flex gap-2">
    <input className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" value={text} onChange={(event) => setText(event.target.value)} aria-label="Requirement" />
    <Button size="sm" variant="outline" disabled={save.isPending || !text.trim()} onClick={() => save.mutate()}>Save</Button>
    <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate()} aria-label="Remove requirement"><Minus /></Button>
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
  const addRequirement = useMutation({
    mutationFn: () => settingsApi.addRequirement(documentType.id, newRequirement),
    onSuccess: () => { setNewRequirement(''); refresh(); toast({ message: 'Requirement added.' }); },
    onError: () => toast({ message: 'Unable to add the requirement.', tone: 'error' }),
  });
  return <Card>
    <CardHeader><CardTitle>{documentType.name}</CardTitle><CardDescription>{documentType.description}</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div><label className="text-sm font-medium" htmlFor={`${documentType.id}-instructions`}>Additional AI instructions</label>
        <textarea id={`${documentType.id}-instructions`} className="mt-2 min-h-24 w-full rounded-md border p-3 text-sm" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Add document-specific guidance for the AI reviewer." />
        <Button className="mt-2" size="sm" disabled={saveInstructions.isPending} onClick={() => saveInstructions.mutate()}>{saveInstructions.isPending ? 'Saving…' : 'Save instructions'}</Button>
      </div>
      <div className="space-y-2"><p className="text-sm font-medium">Requirements</p>
        {documentType.requirements.map((requirement) => <RequirementRow key={requirement.id} documentTypeId={documentType.id} requirement={requirement} />)}
        <div className="flex gap-2 pt-1"><input className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" value={newRequirement} onChange={(event) => setNewRequirement(event.target.value)} placeholder="New requirement" />
          <Button size="sm" disabled={addRequirement.isPending || !newRequirement.trim()} onClick={() => addRequirement.mutate()}><Plus /> Add</Button>
        </div>
      </div>
    </CardContent>
  </Card>;
}

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.list });
  if (settings.isLoading) return <main className="p-12 text-muted-foreground">Loading settings…</main>;
  if (settings.isError || !settings.data) return <main className="p-12">Unable to load settings.</main>;
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-6 py-12">
    <Link className="text-sm text-muted-foreground hover:underline" to="/">← Dashboard</Link>
    <header><p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Tough Leaf</p><h1 className="mt-2 text-3xl font-semibold">Review settings</h1><p className="mt-2 text-muted-foreground">Requirements and instructions are included in future AI document reviews.</p></header>
    <section className="space-y-4">{settings.data.documentTypes.map((documentType) => <DocumentTypeSettings key={documentType.id} documentType={documentType} />)}</section>
  </main>;
}
