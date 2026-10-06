'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  orderingApi,
  type CreateOrder,
  type PaymentMethod,
} from '@repo/api-client';
import { restoreCart, prepareOrder } from '../lib/cart';
import { ApiError, clientFetch } from '../lib/fetch/client';
import { Action, ErrorNotice, money } from './shared';
export function CustomerMenu({
  kind,
  token,
}: {
  kind: 'q' | 's';
  token: string;
}) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ['menu', kind, token],
    queryFn: () => clientFetch(orderingApi.menu(kind, token)),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    retry: 1,
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [pending, setPending] = useState<CreateOrder | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = `order:${kind}:${token}`;
  useEffect(() => {
    try {
      const s = restoreCart(localStorage.getItem(key));
      if (s) {
        setCart(s.cart);
        setNotes(s.notes);
        setPending(s.pending);
        if (s.pending) setCheckout(true);
      }
    } catch {
      setError('Saved cart could not be restored.');
    }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(key, JSON.stringify({ cart, notes, pending }));
      } catch {
        setError('Keep this page open until the order is confirmed.');
      }
    }
  }, [cart, notes, pending, loaded, key]);
  const products = query.data?.categories.flatMap((c) => c.products) || [];
  const selected = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, quantity]) => ({
      product: products.find((p) => p.id === id),
      id,
      quantity,
    }));
  const count = selected.reduce((v, x) => v + x.quantity, 0);
  const total =
    selected.reduce(
      (v, x) =>
        v + Math.round(Number(x.product?.price || 0) * 100) * x.quantity,
      0,
    ) / 100;
  const invalid = selected.some((x) => !x.product || !x.product.available);
  function change(id: string, delta: number) {
    if (pending || busy) return;
    setCart((c) => ({
      ...c,
      [id]: Math.min(30, Math.max(0, (c[id] || 0) + delta)),
    }));
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const request =
        pending ||
        prepareOrder(
          cart,
          notes,
          products,
          query.data?.settings.paymentMode === 'PER_ORDER' ? method : null,
          crypto.randomUUID(),
        );
      localStorage.setItem(
        key,
        JSON.stringify({ cart, notes, pending: request }),
      );
      setPending(request);
      const order = await clientFetch(orderingApi.create(kind, token, request));
      localStorage.removeItem(key);
      setPending(null);
      setCart({});
      setNotes({});
      router.push(`/${kind}/${token}/order/${order.id}`);
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && [400, 404, 409].includes(e.status)) {
        setPending(null);
        await query.refetch();
      }
    } finally {
      setBusy(false);
    }
  }
  if (!query.data)
    return (
      <main className="mx-auto max-w-[650px] px-[22px] pt-6 pb-[110px]">
        <div className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]">
          ORDERLY
        </div>
        <ErrorNotice error={query.error} />
        <p>
          {query.isPending
            ? 'Opening menu…'
            : 'This QR is not accepting orders.'}
        </p>
        <Action onClick={() => void query.refetch()}>Try again</Action>
      </main>
    );
  const { branch, servicePoint, session, categories, settings } = query.data;
  const location =
    session?.label ||
    servicePoint?.name ||
    (settings.fulfillmentMode === 'PICKUP' ? 'Pickup' : 'Your location');
  return (
    <main className="mx-auto max-w-[650px] px-[22px] pt-6 pb-[110px]">
      <header className="mb-[42px] flex items-center justify-between max-[760px]:mb-[30px]">
        <a
          href={`/${kind}/${token}`}
          className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]"
        >
          ORDERLY
        </a>
        <span className="border-orderly-ink rounded-lg border px-3 py-2 text-[13px] font-bold">
          {location}
        </span>
      </header>
      <div className="mt-[26px] text-[10px] font-bold tracking-[2px]">
        {branch.name.toUpperCase()}
      </div>
      <h1 className="max-[760px]:text-[34px]">
        {checkout ? 'Review your order' : 'What sounds good?'}
      </h1>
      <p className="text-orderly-muted text-sm">
        {session?.description ||
          servicePoint?.description ||
          'Order from your phone. Staff will take it from here.'}
      </p>
      <ErrorNotice error={error || query.error} />
      {pending && (
        <div className="my-5 rounded-xl border border-[#e2d19b] bg-[#f4ebce] p-[18px] text-[#6c5427]">
          Your previous submission may have reached the restaurant. Retry it
          safely using the same request.
        </div>
      )}
      {!checkout ? (
        <>
          <nav className="bg-orderly-bg sticky top-0 z-[2] flex gap-2 overflow-x-auto py-[15px]">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="border-orderly-line bg-orderly-surface rounded-full border px-[17px] py-2.5 text-[13px] whitespace-nowrap"
              >
                {c.name}
              </a>
            ))}
          </nav>
          {categories.map((c) => (
            <section id={c.id} key={c.id} className="scroll-mt-[75px]">
              <div className="border-orderly-ink flex items-center justify-between border-b pt-[30px] pb-3">
                <h2>{c.name}</h2>
              </div>
              {c.products.map((p) => (
                <article
                  key={p.id}
                  className={`border-orderly-line flex items-center gap-[14px] border-b py-[22px] ${!p.available ? 'opacity-60' : ''}`}
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      className="size-[65px] rounded-xl object-cover"
                      alt=""
                    />
                  )}
                  <div className="flex-1">
                    <h3>{p.name}</h3>
                    {p.description && (
                      <p className="my-[5px] text-[13px]">{p.description}</p>
                    )}
                    <strong className="mt-[7px] block text-[15px]">
                      {money(p.price)}
                    </strong>
                  </div>
                  {p.available ? (
                    <div className="flex items-center gap-[9px] [&_button]:size-11 [&_button]:p-0 [&_button]:text-[23px]">
                      <button
                        aria-label={`Remove one ${p.name}`}
                        disabled={!!pending || busy || !cart[p.id]}
                        onClick={() => change(p.id, -1)}
                      >
                        −
                      </button>
                      <span className="min-w-[18px] text-center">
                        {cart[p.id] || 0}
                      </span>
                      <button
                        aria-label={`Add one ${p.name}`}
                        disabled={!!pending || busy || (cart[p.id] || 0) >= 30}
                        onClick={() => change(p.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-md bg-[#e9ece5] px-[9px] py-[6px] text-[10px] font-bold tracking-[0.6px] whitespace-nowrap text-[#596750]">
                      Sold out
                    </span>
                  )}
                </article>
              ))}
            </section>
          ))}
          <div className="bg-orderly-ink fixed bottom-[18px] left-1/2 z-[5] flex w-[calc(100%-32px)] max-w-[610px] -translate-x-1/2 items-center justify-between rounded-2xl px-[18px] py-[14px] text-white shadow-[0_8px_40px_#18342c33]">
            <div className="flex flex-col">
              <strong>{count} items</strong>
              <span className="text-[13px] opacity-75">{money(total)}</span>
            </div>
            <Action disabled={!count} onClick={() => setCheckout(true)}>
              View order →
            </Action>
          </div>
        </>
      ) : (
        <>
          <button
            className="border-0 bg-transparent pl-0"
            onClick={() => setCheckout(false)}
          >
            ← Back to menu
          </button>
          <section className="border-orderly-line bg-orderly-surface my-5 rounded-[18px] border p-6">
            {selected.map((x) => (
              <div key={x.id}>
                <div className="border-orderly-line flex items-center justify-between gap-[15px] border-b py-[14px]">
                  <strong>
                    {x.quantity} × {x.product?.name || 'Unavailable'}
                  </strong>
                  <span>
                    {money(Number(x.product?.price || 0) * x.quantity)}
                  </span>
                  <button
                    disabled={!!pending || busy}
                    aria-label="Remove item"
                    onClick={() => setCart((c) => ({ ...c, [x.id]: 0 }))}
                  >
                    ×
                  </button>
                </div>
                <input
                  aria-label={`Note for ${x.product?.name}`}
                  placeholder="Note for staff (optional)"
                  maxLength={240}
                  value={notes[x.id] || ''}
                  disabled={!!pending || busy}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [x.id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-5">
              <span>Total</span>
              <strong className="text-[27px]">{money(total)}</strong>
            </div>
          </section>
          {settings.paymentMode === 'PER_ORDER' ? (
            <>
              <h2>Payment</h2>
              <div className="grid grid-cols-2 gap-3">
                {(['CASH', 'PROMPTPAY'] as const).map((m) => (
                  <label
                    key={m}
                    className={`bg-orderly-surface relative m-0 flex flex-col rounded-xl p-[17px] ${method === m ? 'border-orderly-green border-2 !p-4' : 'border-orderly-line border'}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={method === m}
                      disabled={
                        !!pending ||
                        busy ||
                        (m === 'PROMPTPAY' && !settings.promptpayId)
                      }
                      onChange={() => setMethod(m)}
                    />
                    <strong>{m === 'CASH' ? 'Cash' : 'PromptPay'}</strong>
                    <small className="text-orderly-muted font-normal">
                      {m === 'PROMPTPAY'
                        ? 'Transfer and let staff confirm'
                        : 'Pay staff directly'}
                    </small>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="my-5 rounded-xl border border-[#e2d19b] bg-[#f4ebce] p-[18px] text-[#6c5427]">
              {settings.paymentMode === 'AT_CHECKOUT'
                ? 'Pay when your session closes.'
                : 'Staff will handle payment separately.'}
            </div>
          )}
          <Action
            disabled={busy || (!pending && (!count || invalid))}
            onClick={() => void submit()}
          >
            {busy
              ? 'Submitting…'
              : pending
                ? 'Retry this order safely'
                : `Place order · ${money(total)}`}
          </Action>
        </>
      )}
      <footer className="text-orderly-muted py-[35px] text-[10px] tracking-[1px]">
        {branch.name} · {location}
      </footer>
    </main>
  );
}
