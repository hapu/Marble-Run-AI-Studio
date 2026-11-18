import { useCallback, useEffect, useRef, useState } from 'react';
import { CastStatus } from '../types';

interface PresentationConnectionLike extends EventTarget {
  state: string;
  send: (data: string) => void;
  close: () => void;
  terminate?: () => void;
}

interface PresentationRequestLike {
  start: () => Promise<PresentationConnectionLike>;
}

type PresentationRequestCtor = new (urls: string[]) => PresentationRequestLike;

function getInitialTvFlag(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('tv') === '1' || window.location.hash.includes('tv=1');
}

export function useCastSession(
  seed: string,
  onSyncSeed?: (nextSeed: string) => void,
  onLayoutChange?: () => void
) {
  const [isTvMode, setIsTvMode] = useState<boolean>(() => getInitialTvFlag());
  const [castStatus, setCastStatus] = useState<CastStatus>(() =>
    getInitialTvFlag() ? 'casting' : 'idle'
  );
  const [castHelperOpen, setCastHelperOpen] = useState<boolean>(false);
  const connectionRef = useRef<PresentationConnectionLike | null>(null);

  const receiverMode = getInitialTvFlag();

  // Receive seed updates if acting as a Presentation secondary screen
  useEffect(() => {
    const nav = navigator as unknown as {
      presentation?: {
        receiver?: {
          connectionList: Promise<{ connections: PresentationConnectionLike[] }>;
        };
      };
    };
    const receiver = nav.presentation?.receiver;
    if (!receiver) return;

    receiver.connectionList
      .then((list) => {
        for (const conn of list.connections) {
          conn.addEventListener('message', (ev: Event) => {
            try {
              const msg = JSON.parse((ev as MessageEvent<string>).data);
              if (msg?.type === 'SYNC_SEED' && typeof msg.seed === 'string') {
                onSyncSeed?.(msg.seed);
              }
            } catch {
              // Ignore malformed cast messages
            }
          });
        }
      })
      .catch(() => {});
  }, [onSyncSeed]);

  // Sync seed to active Cast PresentationConnection whenever seed changes
  useEffect(() => {
    if (connectionRef.current && connectionRef.current.state === 'connected') {
      try {
        connectionRef.current.send(JSON.stringify({ type: 'SYNC_SEED', seed }));
      } catch {
        // Ignore send errors on closing connections
      }
    }
  }, [seed]);

  const exitTvMode = useCallback(() => {
    if (connectionRef.current) {
      try {
        connectionRef.current.terminate?.() ?? connectionRef.current.close();
      } catch {
        // Ignore
      }
      connectionRef.current = null;
    }
    setIsTvMode(false);
    setCastStatus('idle');
    setCastHelperOpen(false);
    setTimeout(() => onLayoutChange?.(), 50);
  }, [onLayoutChange]);

  const startCast = useCallback(async () => {
    if (isTvMode) {
      exitTvMode();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('tv', '1');
    url.hash = `seed=${encodeURIComponent(seed)}`;

    const Ctor = (window as unknown as { PresentationRequest?: PresentationRequestCtor })
      .PresentationRequest;

    if (Ctor) {
      try {
        const request = new Ctor([url.toString()]);
        const conn = await request.start();
        connectionRef.current = conn;
        setCastStatus('casting');
        setCastHelperOpen(false);

        conn.addEventListener('close', () => {
          connectionRef.current = null;
          setCastStatus('idle');
        });
        conn.addEventListener('terminate', () => {
          connectionRef.current = null;
          setCastStatus('idle');
        });
        return;
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        // If user explicitly dismissed the native device picker, abort cleanly
        if (name === 'AbortError') {
          return;
        }
        // Otherwise (sandboxed iframe SecurityError / NotAllowedError / NotFoundError), fall back to TV Theater Mode
      }
    }

    setIsTvMode(true);
    setCastStatus('tv_fallback');
    setCastHelperOpen(true);
    setTimeout(() => onLayoutChange?.(), 50);
  }, [isTvMode, seed, exitTvMode, onLayoutChange]);

  return {
    isTvMode,
    receiverMode,
    castStatus,
    castHelperOpen,
    setCastHelperOpen,
    startCast,
    exitTvMode,
  };
}
