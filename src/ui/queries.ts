'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BabyBundle, Me, MeUser } from '@/lib/types';
import { api } from './api';

export const ME_KEY = ['me'] as const;
export const babyKey = (id: string) => ['baby', id] as const;

// One options object for every reader of the profile: React Query refetches
// with the options of whichever observer mounted last, so a reader without
// the queryFn would break everyone's refetch.
export const meQuery = { queryKey: ME_KEY, queryFn: () => api<Me>('/api/me') };

/** The signed-in user, their households and babies. */
export function useMe() {
  return useQuery(meQuery);
}

/** One baby's whole record; every display is derived from it. */
export function useBabyBundle(id: string | undefined) {
  return useQuery({ queryKey: babyKey(id ?? ''), queryFn: () => api<BabyBundle>(`/api/babies/${id}`), enabled: Boolean(id) });
}

/** Refetches the profile and every loaded baby: used after anything that changes membership or babies. */
export function useRefreshAll() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: ME_KEY }), client.invalidateQueries({ queryKey: ['baby'] })]);
}

export function useRefreshBaby(id: string | undefined) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: babyKey(id ?? '') });
}

type Prefs = Partial<Pick<MeUser, 'theme' | 'palette' | 'defaultDataView' | 'nudgesEnabled'>>;

/**
 * Settings apply on screen at once and are saved behind; a failed save
 * rolls the screen back, so what is shown is always what is stored.
 */
export function useSavePrefs() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Prefs) => api('/api/me', { method: 'PATCH', body: prefs }),
    onMutate: async (prefs) => {
      await client.cancelQueries({ queryKey: ME_KEY });
      const before = client.getQueryData<Me>(ME_KEY);
      if (before) client.setQueryData<Me>(ME_KEY, { ...before, user: { ...before.user, ...prefs } });
      return { before };
    },
    onError: (_error, _prefs, context) => {
      if (context?.before) client.setQueryData(ME_KEY, context.before);
    },
  });
}
