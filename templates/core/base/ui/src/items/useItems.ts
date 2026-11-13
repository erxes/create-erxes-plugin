import type { InferClientOutputs } from '@orpc/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Client } from '@__id__/api';
import { useSearchParams } from 'react-router-dom';
import { orpc } from '../orpc.ts';

export type Item = InferClientOutputs<Client>['items']['create'];

/** Every page loaded so far, newest first. */
export const useItems = () =>
  useInfiniteQuery(
    orpc.items.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor }),
      initialPageParam: undefined,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    }),
  );

/** `?item=<id>` opens that item in the side panel, `?item=new` a blank one. */
export const useOpenItem = () => {
  const [params, setParams] = useSearchParams();

  return {
    openId: params.get('item'),
    open: (id: string) => setParams({ item: id }),
    close: () => setParams({}),
  };
};
