'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderingApi, type Order } from '@repo/api-client';
import { clientFetch } from '../lib/fetch/client';
import { StaffShell } from './staff-shell';
import { OrderCard } from './order-card';
import { Action, ErrorNotice, money } from './shared';
import { useScreenWakeLock } from './use-screen-wake-lock';
const wakeMessages = {
  off: '',
  requesting: 'Requesting screen wake lock…',
  active: 'Screen will stay awake while this tab is visible.',
  paused: 'Paused while this tab is hidden.',
  unavailable: 'Browser or device denied the screen wake lock.',
};
export function StaffOrders({
  history = false,
  id,
}: {
  history?: boolean;
  id?: string;
}) {
  return (
    <StaffShell>
      <Orders history={history} id={id} />
    </StaffShell>
  );
}
function Orders({ history, id }: { history: boolean; id?: string }) {
  const cache = useQueryClient(),
    [sound, setSound] = useState(false),
    [keepAwake, setKeepAwake] = useState(false),
    [connected, setConnected] = useState(false),
    [fresh, setFresh] = useState<string | null>(null);
  const wakeLock = useScreenWakeLock(keepAwake && !history && !id);
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    setKeepAwake(localStorage.getItem('orderly-staff-keep-awake') === 'true');
  }, []);
  const query = useQuery({
    queryKey: ['staff-orders', history, id],
    queryFn: () =>
      id
        ? clientFetch(orderingApi.detail(id)).then((o) => ({
            orders: [o],
            nextCursor: null,
          }))
        : clientFetch(orderingApi.orders(history)),
    refetchInterval: 15000,
  });
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => clientFetch(orderingApi.summary()),
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (!query.data) return;
    const ids = new Set(query.data.orders.map((o) => o.id));
    if (known.current && sound && !history) {
      const isNew = query.data.orders.find(
        (o) => !known.current?.has(o.id) && o.status === 'NEW',
      );
      if (isNew) {
        setFresh(isNew.id);
        try {
          const c = new AudioContext();
          const oscillator = c.createOscillator();
          const gain = c.createGain();
          oscillator.connect(gain);
          gain.connect(c.destination);
          oscillator.frequency.value = 780;
          gain.gain.setValueAtTime(0.08, c.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
          oscillator.start();
          oscillator.stop(c.currentTime + 0.18);
          oscillator.onended = () => void c.close();
        } catch {
          /* Browser audio is optional. */
        }
      }
    }
    known.current = ids;
  }, [query.data, sound, history]);
  useEffect(() => {
    if (history || id) return;
    const stream = new EventSource('/api/staff/events');
    stream.onopen = () => {
      setConnected(true);
      void cache.invalidateQueries({ queryKey: ['staff-orders'] });
    };
    stream.onerror = () => setConnected(false);
    stream.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { kind: string };
        if (data.kind === 'new' || data.kind === 'changed') {
          void cache.invalidateQueries({ queryKey: ['staff-orders'] });
          void cache.invalidateQueries({ queryKey: ['summary'] });
        }
      } catch {
        /* Ignore malformed event and rely on polling. */
      }
    };
    return () => {
      stream.close();
    };
  }, [history, id, cache]);
  const orders = query.data?.orders || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LIVE SERVICE</div>
          <h1>
            {id
              ? 'Order detail'
              : history
                ? 'Order history'
                : 'Orders to serve'}
          </h1>
          <p>Orders stay in the database and reload after connection loss.</p>
        </div>
        <div className="connection">
          <span className={connected ? 'online' : ''}>
            {history
              ? 'History'
              : connected
                ? 'Live connection'
                : 'Refreshing every 15s'}
          </span>
          <Action secondary onClick={() => setSound(true)}>
            {sound ? 'Sound on' : 'Enable sound'}
          </Action>
          {!history && !id && (
            <>
              <Action
                secondary
                onClick={() => {
                  const next = !keepAwake;
                  localStorage.setItem(
                    'orderly-staff-keep-awake',
                    String(next),
                  );
                  setKeepAwake(next);
                }}
              >
                {keepAwake ? 'Allow screen sleep' : 'Keep screen awake'}
              </Action>
              {keepAwake && (
                <small className="wake-status" role="status">
                  {wakeMessages[wakeLock.status]}
                </small>
              )}
              {keepAwake && wakeLock.status === 'unavailable' && (
                <Action secondary onClick={wakeLock.retry}>
                  Retry screen wake lock
                </Action>
              )}
            </>
          )}
        </div>
      </div>
      {!id && summary.data && (
        <div className="summary-strip">
          <div>
            <small>Today · {summary.data.date}</small>
            <strong>{summary.data.orderCount} orders</strong>
          </div>
          <div>
            <small>Paid total</small>
            <strong>{money(summary.data.total)}</strong>
          </div>
          <div>
            <small>Cash</small>
            <strong>{money(summary.data.cash)}</strong>
          </div>
          <div>
            <small>PromptPay</small>
            <strong>{money(summary.data.promptpay)}</strong>
          </div>
        </div>
      )}
      <ErrorNotice error={query.error} />
      {orders.length ? (
        <div className="orders-grid">
          {orders.map((o: Order) => (
            <OrderCard
              key={o.id}
              order={o}
              highlight={fresh === o.id}
              detailed={!!id}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          {query.isPending ? 'Loading…' : 'No orders here yet.'}
        </div>
      )}
    </>
  );
}
