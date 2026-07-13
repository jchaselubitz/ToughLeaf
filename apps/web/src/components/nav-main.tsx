import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { IconCirclePlusFilled, IconMail, type Icon } from '@tabler/icons-react';
import { DOCUMENT_TYPE_META, type DocumentTypeSlug } from '@tl/shared';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { useToast } from '@/components/toast';
import { subcontractorApi } from '@/lib/subcontractors';

const ALL_DOCUMENT_SLUGS = DOCUMENT_TYPE_META.map((type) => type.slug);

export function NavMain({
  items
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<DocumentTypeSlug[]>(ALL_DOCUMENT_SLUGS);
  const create = useMutation({
    mutationFn: subcontractorApi.create,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      setOpen(false);
      setSelectedSlugs(ALL_DOCUMENT_SLUGS);
      toast({
        message: result.emailError
          ? 'Subcontractor added, but the email could not be sent.'
          : 'Subcontractor added successfully.',
        tone: result.emailError ? 'error' : 'success'
      });
    },
    onError: (error) =>
      toast({
        message: error instanceof Error ? error.message : 'Unable to add the subcontractor.',
        tone: 'error'
      })
  });

  function toggleSlug(slug: DocumentTypeSlug, checked: boolean) {
    setSelectedSlugs((current) =>
      checked ? [...current, slug] : current.filter((existing) => existing !== slug)
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const sendInitialEmail = submitter?.value === 'send';
    create.mutate({
      name: String(form.get('name')),
      email: String(form.get('email')),
      dueDate: String(form.get('dueDate')),
      documentTypeSlugs: selectedSlugs,
      sendInitialEmail
    });
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Add subcontractor"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onClick={() => setOpen(true)}
            >
              <IconCirclePlusFilled />
              <span>Add subcontractor</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconMail />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <Link to={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add subcontractor</SheetTitle>
            <SheetDescription>
              Choose which documents to request. The due date applies to every document selected.
            </SheetDescription>
          </SheetHeader>
          <form className="flex flex-col gap-4 px-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="subcontractor-name">Company name</Label>
              <Input required id="subcontractor-name" name="name" placeholder="Company name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcontractor-email">Email</Label>
              <Input
                required
                id="subcontractor-email"
                name="email"
                type="email"
                placeholder="email@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subcontractor-due-date">Due date</Label>
              <Input required id="subcontractor-due-date" name="dueDate" type="date" />
            </div>
            <div className="grid gap-2">
              <Label>Documents to request</Label>
              <div className="flex flex-col gap-2">
                {DOCUMENT_TYPE_META.map((type) => (
                  <div key={type.slug} className="flex items-center gap-2">
                    <Checkbox
                      id={`document-${type.slug}`}
                      checked={selectedSlugs.includes(type.slug)}
                      onCheckedChange={(checked) => toggleSlug(type.slug, checked === true)}
                    />
                    <Label htmlFor={`document-${type.slug}`} className="font-normal">
                      {type.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
            <SheetFooter className="flex-row gap-2">
              <Button
                type="submit"
                name="action"
                value="save"
                variant="outline"
                disabled={create.isPending || selectedSlugs.length === 0}
              >
                {create.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="submit"
                name="action"
                value="send"
                disabled={create.isPending || selectedSlugs.length === 0}
              >
                {create.isPending ? 'Saving…' : 'Save & send email'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </SidebarGroup>
  );
}
