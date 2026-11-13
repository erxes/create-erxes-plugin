import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, Sheet, Textarea, toast } from 'erxes-ui';
import { useTranslation } from 'react-i18next';
import { orpc } from '../orpc.ts';
import { type Item, useOpenItem } from './useItems.ts';

const textOf = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '');

/** The side panel: a new item, or one from the list to change. */
export const ItemSheet = ({ items }: { items: Item[] }) => {
  const { t } = useTranslation('__id__');
  const { openId, close } = useOpenItem();
  const queryClient = useQueryClient();
  const item = items.find((candidate) => candidate.id === openId);

  const options = {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.items.key() });
      close();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: t('save-failed', 'Could not save'),
        description: error.message,
      });
    },
  };

  const create = useMutation(orpc.items.create.mutationOptions(options));
  const update = useMutation(orpc.items.update.mutationOptions(options));

  const save = (form: FormData) => {
    const fields = {
      name: textOf(form.get('name')),
      description: textOf(form.get('description')),
    };

    if (item) update.mutate({ id: item.id, ...fields });
    else create.mutate(fields);
  };

  return (
    <Sheet open={Boolean(openId)} onOpenChange={(open) => !open && close()}>
      <Sheet.View className="sm:max-w-md">
        <Sheet.Header>
          <Sheet.Title>{item ? item.name : t('new-item', 'New item')}</Sheet.Title>
        </Sheet.Header>
        {openId === 'new' || item ? (
          <form key={item?.id ?? 'new'} action={save} className="flex flex-1 flex-col">
            <Sheet.Content className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="item-name">{t('name', 'Name')}</Label>
                <Input id="item-name" name="name" required defaultValue={item?.name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="item-description">{t('description', 'Description')}</Label>
                <Textarea
                  id="item-description"
                  name="description"
                  defaultValue={item?.description}
                />
              </div>
            </Sheet.Content>
            <Sheet.Footer>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {t('save', 'Save')}
              </Button>
            </Sheet.Footer>
          </form>
        ) : (
          <Sheet.Content className="p-4 text-sm text-muted-foreground">
            {t('not-found', 'This item is not in the list.')}
          </Sheet.Content>
        )}
      </Sheet.View>
    </Sheet>
  );
};
