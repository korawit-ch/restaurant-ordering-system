'use client';
import { useEffect, useState } from 'react';

type WakeStatus = 'off' | 'requesting' | 'active' | 'paused' | 'unavailable';

export function useScreenWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeStatus>('off');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let requesting = false;
    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      if (cancelled || requesting || (lock && !lock.released)) return;
      if (!('wakeLock' in navigator)) {
        setStatus('unavailable');
        return;
      }
      if (document.visibilityState !== 'visible') {
        setStatus('paused');
        return;
      }
      requesting = true;
      setStatus('requesting');
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (cancelled || document.visibilityState !== 'visible') {
          await acquired.release();
          return;
        }
        lock = acquired;
        setStatus('active');
        acquired.addEventListener('release', () => {
          if (lock === acquired) lock = null;
          if (!cancelled)
            setStatus(
              document.visibilityState === 'visible' ? 'unavailable' : 'paused',
            );
        });
      } catch {
        if (!cancelled) setStatus('unavailable');
      } finally {
        requesting = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
      else setStatus('paused');
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (lock) void lock.release();
    };
  }, [enabled, attempt]);

  return {
    status: enabled ? status : 'off',
    retry: () => setAttempt((value) => value + 1),
  };
}
