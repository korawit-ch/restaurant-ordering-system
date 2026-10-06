'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderingApi } from '@repo/api-client';
import { ApiError, clientFetch } from '../lib/fetch/client';
import { ErrorNotice, money, Status } from './shared';
export function CustomerOrder({
  kind,
  token,
  id,
}: {
  kind: 'q' | 's';
  token: string;
  id: string;
}) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<unknown>(null);
  let submitLabel = slip ? 'Upload slip and notify staff' : 'I have paid';
  if (claimBusy) submitLabel = 'Submitting…';
  const query = useQuery({
    queryKey: ['order', kind, token, id],
    queryFn: () => clientFetch(orderingApi.order(kind, token, id)),
    refetchInterval: 5000,
  });
  const o = query.data;
  const pay = useQuery({
    queryKey: ['payment', id],
    queryFn: () => clientFetch(orderingApi.orderPromptpay(kind, token, id)),
    enabled:
      !!o && o.paymentMethod === 'PROMPTPAY' && o.paymentStatus === 'PENDING',
    retry: false,
  });
  async function submitClaim() {
    setClaimBusy(true);
    setClaimError(null);
    try {
      if (slip) {
        if (slip.size > 5 * 1024 * 1024)
          throw new Error('Choose a slip image smaller than 5 MB.');
        const form = new FormData();
        form.set('file', slip);
        if (reference.trim()) form.set('reference', reference.trim());
        if (note.trim()) form.set('note', note.trim());
        const response = await fetch(
          `/api/public/${kind}/${encodeURIComponent(token)}/orders/${encodeURIComponent(id)}/payment-slip`,
          { method: 'POST', credentials: 'same-origin', body: form },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new ApiError(
            body.message || 'Slip upload failed. Please try again.',
            response.status,
          );
        }
      } else {
        await clientFetch(
          orderingApi.submitPaymentClaim(kind, token, id, {
            ...(reference.trim() ? { reference: reference.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        );
      }
      await query.refetch();
    } catch (error) {
      setClaimError(error);
    } finally {
      setClaimBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-[650px] px-[22px] pt-6 pb-[110px] text-center">
      <div className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]">
        ORDERLY
      </div>
      <ErrorNotice error={query.error} />
      {!o ? (
        <p>Loading order…</p>
      ) : (
        <>
          <div className="bg-orderly-accent mx-auto mt-10 mb-[15px] grid size-[70px] place-items-center rounded-full text-4xl">
            ✓
          </div>
          <div className="mt-[26px] text-[10px] font-bold tracking-[2px]">
            {o.locationSnapshot || 'PICKUP'} · ORDER #{o.orderNumber}
          </div>
          <h1>Order received.</h1>
          <p>Staff can see your order. Check here for updates.</p>
          <div className="flex justify-center gap-2.5">
            <Status value={o.status} />
            <Status value={o.paymentStatus} />
          </div>
          <section className="border-orderly-line bg-orderly-surface my-5 rounded-[18px] border p-6">
            {o.items.map((i) => (
              <div
                className="border-orderly-line flex items-center justify-between gap-[15px] border-b py-[14px]"
                key={i.id}
              >
                <div>
                  <strong>
                    {i.quantity} × {i.productNameSnapshot}
                  </strong>
                  {i.note && <small>{i.note}</small>}
                </div>
                <span>{money(i.lineTotal)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-5">
              <span>{o.paymentMethod || 'Pay at checkout'}</span>
              <strong>{money(o.total)}</strong>
            </div>
          </section>
          {o.paymentStatus === 'PENDING' && o.paymentMethod === 'PROMPTPAY' && (
            <section className="border-orderly-line bg-orderly-surface my-5 rounded-[18px] border p-6">
              <h2>Pay {money(o.total)} with PromptPay</h2>
              {pay.data && (
                <img
                  className="mx-auto my-5 block w-[260px] max-w-full"
                  src={`data:image/svg+xml,${encodeURIComponent(pay.data.svg)}`}
                  alt="PromptPay QR"
                />
              )}
              <p>
                Check the recipient and amount in your banking app. After
                paying, tell staff below. This does not mark the order paid
                until staff sees the deposit in the restaurant account.
              </p>
              {o.paymentClaim?.status === 'SUBMITTED' ? (
                <div className="my-5 rounded-xl border border-[#e2d19b] bg-[#f4ebce] p-[18px] text-[#6c5427]">
                  Payment evidence submitted. Staff is checking the bank
                  account.
                  {o.paymentSlip && ' Your slip was received.'}
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {o.paymentClaim?.status === 'REJECTED' && (
                    <div className="my-5 my-[15px] rounded-xl border border-[#e2d19b] border-[#edb5a3] bg-[#f4ebce] bg-[#ffe7df] p-[14px] p-[18px] text-[#6c5427] text-[#882e1b]">
                      Staff could not match the payment
                      {o.paymentClaim.reviewNote
                        ? `: ${o.paymentClaim.reviewNote}`
                        : '. Please check and submit again.'}
                    </div>
                  )}
                  <label>
                    Bank reference (optional)
                    <input
                      value={reference}
                      maxLength={100}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Reference shown by your bank"
                    />
                  </label>
                  <label>
                    Note (optional)
                    <input
                      value={note}
                      maxLength={240}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Paying bank or transfer time"
                    />
                  </label>
                  {pay.data?.slipUploadEnabled && (
                    <label>
                      Bank slip image (optional, JPEG or PNG, up to 5 MB)
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(event) =>
                          setSlip(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                  )}
                  {slip && (
                    <small>
                      Staff will review this image against the receiving bank
                      account.
                    </small>
                  )}
                  <ErrorNotice error={claimError} />
                  <button
                    className="border-orderly-green bg-orderly-green flex min-h-[50px] items-center justify-center gap-[15px] rounded-[11px] border px-5 py-3 text-[15px] font-semibold text-white no-underline hover:bg-[#163e2e]"
                    type="button"
                    disabled={claimBusy}
                    onClick={() => void submitClaim()}
                  >
                    {submitLabel}
                  </button>
                </div>
              )}
            </section>
          )}
          {o.paymentStatus === 'PENDING' && o.paymentMethod === 'CASH' && (
            <div className="my-5 rounded-xl border border-[#e2d19b] bg-[#f4ebce] p-[18px] text-[#6c5427]">
              Pay staff {money(o.total)} in cash.
            </div>
          )}
          <Link
            className="border-orderly-green bg-orderly-green flex min-h-[50px] items-center justify-center gap-[15px] rounded-[11px] border px-5 py-3 text-[15px] font-semibold text-white no-underline hover:bg-[#163e2e]"
            href={`/${kind}/${token}`}
          >
            Order again →
          </Link>
        </>
      )}
    </main>
  );
}
