'use client';

import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import MoreIcon from '@mui/icons-material/MoreHoriz';
import GrowthIcon from '@mui/icons-material/ShowChart';
import TimelineIcon from '@mui/icons-material/ViewAgendaOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Role } from '@/db/schema';
import type { Baby, HouseholdSummary, Me } from '@/lib/types';
import { messageOf } from '../api';
import { useTokens } from '../Providers';
import { useMe } from '../queries';
import { QuickAdd, type AddKind } from './QuickAdd';

// --- The selected baby, remembered on this device -------------------------------

const BABY_KEY = 'ls-baby';
const BABY_EVENT = 'ls-baby-change';

function subscribeBaby(onChange: () => void) {
  window.addEventListener(BABY_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(BABY_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

// --- Context -------------------------------------------------------------------

export interface BabyInHousehold extends Baby {
  role: Role;
  householdName: string;
}

interface App {
  me: Me;
  /** Every baby the user can see that isn't archived, across households. */
  babies: BabyInHousehold[];
  /** The baby on screen; null only when there are none yet. */
  baby: BabyInHousehold | null;
  household: HouseholdSummary | null;
  canEdit: boolean;
  selectBaby: (id: string) => void;
  /** Opens the add sheet, optionally straight to one kind, or to one library first (from a nudge). */
  openAdd: (kind?: AddKind, milestoneKey?: string) => void;
}

const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp must be used inside <AppShell>');
  return app;
}

// --- Navigation ----------------------------------------------------------------

const NAV = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/timeline', label: 'Timeline', Icon: TimelineIcon },
  { href: '/growth', label: 'Growth', Icon: GrowthIcon },
  { href: '/more', label: 'More', Icon: MoreIcon },
];

export const NAV_HEIGHT = 80;

function BottomNav({ pathname }: { pathname: string }) {
  const { ls } = useTokens();
  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 10, bgcolor: ls.surfaceContainer, pb: 'env(safe-area-inset-bottom)', display: 'flex', justifyContent: 'center' }}
    >
      <Box sx={{ display: 'flex', width: '100%', maxWidth: 640, height: NAV_HEIGHT }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <ButtonBase
              key={href}
              component={Link}
              href={href}
              aria-current={active ? 'page' : undefined}
              sx={{ flex: 1, flexDirection: 'column', gap: 0.5, fontFamily: 'inherit', color: active ? ls.onSurface : ls.onSurfaceVariant }}
            >
              {/* Material 3's pill behind the active icon; the bold label says the same thing without colour. */}
              <Box sx={{ width: 64, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center', bgcolor: active ? ls.secondaryContainer : 'transparent', color: active ? ls.onSecondaryContainer : 'inherit' }}>
                <Icon />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: active ? 800 : 600 }}>
                {label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 360 }}>
        {children}
      </Stack>
    </Box>
  );
}

// --- Shell ---------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, error, refetch, isFetching } = useMe();
  const storedBabyId = useSyncExternalStore(
    subscribeBaby,
    () => localStorage.getItem(BABY_KEY),
    () => null,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [adding, setAdding] = useState<{ open: boolean; kind?: AddKind; milestone?: string }>({ open: false });

  const onboarding = pathname === '/welcome';
  const needsWelcome = Boolean(me) && me!.households.length === 0;
  useEffect(() => {
    if (needsWelcome && !onboarding) router.replace('/welcome');
  }, [needsWelcome, onboarding, router]);

  const app = useMemo<App | null>(() => {
    if (!me) return null;
    const babies = me.households.flatMap((h) => h.babies.filter((b) => !b.archivedAt).map((b) => ({ ...b, role: h.role, householdName: h.name })));
    const baby = babies.find((b) => b.id === storedBabyId) ?? babies[0] ?? null;
    const household = me.households.find((h) => h.id === baby?.householdId) ?? me.households[0] ?? null;
    return {
      me,
      babies,
      baby,
      household,
      canEdit: Boolean(baby) && baby!.role !== 'viewer',
      selectBaby: (id) => {
        localStorage.setItem(BABY_KEY, id);
        window.dispatchEvent(new Event(BABY_EVENT));
      },
      openAdd: (kind, milestone) => setAdding({ open: true, kind, milestone }),
    };
  }, [me, storedBabyId]);

  if (!app) {
    if (error) {
      return (
        <Centered>
          <Typography variant="h6" component="h1">
            We couldn&apos;t load Little Steps
          </Typography>
          <Typography color="text.secondary">{messageOf(error)}</Typography>
          <Button variant="contained" onClick={() => refetch()} disabled={isFetching}>
            Try again
          </Button>
        </Centered>
      );
    }
    return (
      <Centered>
        <CircularProgress aria-label="Loading" />
      </Centered>
    );
  }
  if (needsWelcome && !onboarding) return null;

  const offline = !online && (
    <Alert severity="warning" role="status" sx={{ borderRadius: 0, justifyContent: 'center' }}>
      You&apos;re offline. You can keep reading; saving needs a connection.
    </Alert>
  );

  if (onboarding) {
    return (
      <AppContext.Provider value={app}>
        {offline}
        {children}
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={app}>
      {offline}
      <Box component="main" sx={{ maxWidth: 640, mx: 'auto', px: 2, pt: 'calc(16px + env(safe-area-inset-top))', pb: `calc(${NAV_HEIGHT + 96}px + env(safe-area-inset-bottom))` }}>
        {children}
      </Box>
      {app.canEdit && (
        <Box sx={{ position: 'fixed', insetInline: 0, bottom: `calc(${NAV_HEIGHT + 16}px + env(safe-area-inset-bottom))`, zIndex: 11, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 640, px: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Fab aria-label={`Add something for ${app.baby!.name}`} onClick={() => setAdding({ open: true })} sx={{ pointerEvents: 'auto', width: 64, height: 64 }}>
              <AddIcon fontSize="large" />
            </Fab>
          </Box>
        </Box>
      )}
      <BottomNav pathname={pathname} />
      {app.baby && <QuickAdd key={app.baby.id} baby={app.baby} open={adding.open} initialKind={adding.kind} initialMilestone={adding.milestone} onClose={() => setAdding({ open: false })} />}
    </AppContext.Provider>
  );
}
