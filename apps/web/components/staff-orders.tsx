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
      <div className="mb-[30px] flex items-center justify-between gap-[25px] max-[1100px]:items-start max-[760px]:flex-col max-[760px]:gap-2.5">
        <div>
          <div className="text-[10px] font-bold tracking-[2px]">
            LIVE SERVICE
          </div>
          <h1>
            {id
              ? 'Order detail'
              : history
                ? 'Order history'
                : 'Orders to serve'}
          </h1>
          <p>Orders stay in the database and reload after connection loss.</p>
        </div>
        <div className="flex flex-col gap-3 text-xs whitespace-nowrap max-[760px]:flex-row max-[760px]:flex-wrap max-[760px]:items-center">
          <span className={connected ? 'text-[#38714e]' : 'text-[#b06a28]'}>
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
                <small
                  className="max-w-[230px] whitespace-normal"
                  role="status"
                >
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
        <div className="border-orderly-line bg-orderly-surface [&>div]:border-orderly-line [&_small]:text-orderly-muted mb-[30px] grid grid-cols-[1.5fr_1fr_1fr_1fr] rounded-[15px] border p-[22px] max-[1100px]:p-[18px] max-[760px]:grid-cols-2 max-[760px]:gap-[18px] [&_small]:text-[11px] [&_strong]:text-2xl [&>div]:flex [&>div]:flex-col [&>div]:gap-[7px] [&>div]:border-r [&>div]:px-5 max-[760px]:[&>div]:border-0 max-[760px]:[&>div]:p-0 [&>div:first-child]:pl-0 [&>div:last-child]:border-0">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-start gap-5 max-[760px]:grid-cols-1">
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
        <div className="rounded-2xl border border-dashed border-[#bcc8b7] bg-[#f8f8f1] px-[25px] py-20 text-center">
          {query.isPending ? 'Loading…' : 'No orders here yet.'}
        </div>
      )}
    </>
  );
}
