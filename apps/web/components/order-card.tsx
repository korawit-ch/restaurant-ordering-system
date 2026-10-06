'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { orderingApi, type Order, type OrderStatus } from '@repo/api-client';
import { clientFetch } from '../lib/fetch/client';
import { Action, ErrorNotice, money, Status } from './shared';
const next: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};
const labels: Partial<Record<OrderStatus, string>> = {
  NEW: 'Accept',
  ACCEPTED: 'Preparing',
  PREPARING: 'Ready',
  READY: 'Complete',
};
export function OrderCard({
  order,
  highlight = false,
  detailed = false,
}: {
  order: Order;
  highlight?: boolean;
  detailed?: boolean;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const active = !['COMPLETED', 'CANCELLED'].includes(order.status);
  async function update(action: 'payment' | OrderStatus) {
    if (
      action === 'CANCELLED' &&
      !confirm(`Cancel order #${order.orderNumber}?`)
    )
      return;
    let paymentBody: { reference?: string; note?: string } = {};
    if (action === 'payment') {
      if (order.paymentMethod === 'PROMPTPAY') {
        const reference = prompt(
          'Check the receiving bank account, then enter its transaction reference:',
          '',
        );
        if (reference === null) return;
        if (reference.trim().length < 2) {
          setError(new Error('A bank transaction reference is required.'));
          return;
        }
        const note = prompt(
          'Optional verification note (bank, received time, or staff note):',
          '',
        );
        if (note === null) return;
        paymentBody = {
          reference: reference.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      } else if (!confirm('Confirm full cash payment received?')) return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientFetch(
        action === 'payment'
          ? orderingApi.confirm(order.id, paymentBody)
          : orderingApi.status(order.id, action),
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['staff-orders'] }),
        cache.invalidateQueries({ queryKey: ['summary'] }),
      ]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function rejectClaim() {
    const reason = prompt('Why could this payment not be matched?');
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await clientFetch(
        orderingApi.rejectPaymentClaim(order.id, reason.trim()),
      );
      await cache.invalidateQueries({ queryKey: ['staff-orders'] });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function viewSlip() {
    const tab = window.open('', '_blank');
    if (!tab) {
      setError(new Error('Allow popups to view the payment slip.'));
      return;
    }
    tab.opener = null;
    setBusy(true);
    setError(null);
    try {
      const { url } = await clientFetch(orderingApi.paymentSlipUrl(order.id));
      tab.location.href = url;
    } catch (error) {
      tab.close();
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function createRefund() {
    const amount = prompt('Refund amount in THB:', order.total);
    if (!amount) return;
    const reason = prompt('Reason for refund:');
    if (!reason?.trim()) return;
    const bank = confirm(
      'Use bank transfer? Choose Cancel for a cash refund request.',
    );
    setBusy(true);
    setError(null);
    try {
      await clientFetch(
        orderingApi.createRefund(order.id, {
          amount: amount.trim(),
          method: bank ? 'BANK_TRANSFER' : 'CASH',
          reason: reason.trim(),
        }),
      );
      await cache.invalidateQueries({ queryKey: ['staff-orders'] });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function updateRefund(
    refundId: string,
    method: 'CASH' | 'BANK_TRANSFER',
    action: 'complete' | 'cancel',
  ) {
    let reference: string | undefined;
    if (action === 'complete') {
      if (!confirm('Confirm the refund money has actually been returned?'))
        return;
      if (method === 'BANK_TRANSFER') {
        const value = prompt('Bank transfer reference:');
        if (!value?.trim()) return;
        reference = value.trim();
      }
    } else if (!confirm('Cancel this pending refund request?')) return;
    setBusy(true);
    setError(null);
    try {
      await clientFetch(
        action === 'complete'
          ? orderingApi.completeRefund(order.id, refundId, reference)
          : orderingApi.cancelRefund(order.id, refundId),
      );
      await cache.invalidateQueries({ queryKey: ['staff-orders'] });
      await cache.invalidateQueries({ queryKey: ['summary'] });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className={`bg-orderly-surface rounded-2xl border ${highlight ? 'border-2 border-[#a6bb4e] p-[22px]' : 'border-orderly-line p-[23px]'}`}
    >
      <div className="border-orderly-line flex items-start justify-between border-b pb-[17px]">
        <div>
          <small className="text-orderly-muted text-[10px] tracking-[2px]">
            {order.servicePoint?.type || 'LOCATION'}
          </small>
          <Link href={`/staff/orders/${order.id}`}>
            <h2 className="text-[42px] leading-[1.15] tracking-[-1px]">
              {order.locationSnapshot || `#${order.orderNumber}`}
            </h2>
          </Link>
          {order.session?.description && <p>{order.session.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-[5px] text-xs">
          <strong>#{order.orderNumber}</strong>
          <time className="text-orderly-muted">
            {new Date(order.createdAt).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          <Status value={order.status} />
        </div>
      </div>
      <div className="flex flex-col gap-[14px] py-5">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 text-[15px]">
            <span className="grid h-[30px] min-w-[30px] place-items-center rounded-[5px] bg-[#eeeee4] font-bold">
              {i.quantity}
            </span>
            <span>
              {i.productNameSnapshot}
              {i.note && <small> · {i.note}</small>}
            </span>
            <small className="text-orderly-muted ml-auto text-xs">
              {money(i.lineTotal)}
            </small>
          </div>
        ))}
      </div>
      <div className="border-orderly-line flex items-center justify-between border-t border-dashed py-[18px]">
        <strong className="text-[25px]">{money(order.total)}</strong>
        <span>
          {order.paymentMethod || 'CHECKOUT'}{' '}
          <Status value={order.paymentStatus} />
        </span>
      </div>
      {order.paymentMethod === 'PROMPTPAY' &&
        order.paymentStatus === 'PENDING' && (
          <div className="[&_small]:text-orderly-muted mt-4 grid gap-3 rounded-[10px] border border-[#d5c96c] bg-[#fffbe0] p-3">
            {order.paymentClaim?.status === 'SUBMITTED' ? (
              <>
                <strong>Customer says payment was sent</strong>
                <small>
                  {order.paymentClaim.customerReference
                    ? `Customer reference: ${order.paymentClaim.customerReference}`
                    : 'No customer reference supplied'}
                </small>
                {order.paymentClaim.customerNote && (
                  <small>{order.paymentClaim.customerNote}</small>
                )}
                {order.paymentSlip && (
                  <>
                    <small>
                      Slip image received · QR{' '}
                      {order.paymentSlip.qrReadable
                        ? 'readable'
                        : 'not detected'}
                    </small>
                    {order.paymentSlip.duplicateWarning && (
                      <strong>
                        Possible duplicate slip or QR used for another order.
                        Check carefully.
                      </strong>
                    )}
                    <button
                      className="border-0 bg-transparent pl-0"
                      disabled={busy}
                      onClick={() => void viewSlip()}
                    >
                      View customer slip
                    </button>
                  </>
                )}
                <button
                  className="border-0 bg-transparent pl-0 text-[#a8442c]"
                  disabled={busy}
                  onClick={() => void rejectClaim()}
                >
                  Cannot match payment
                </button>
              </>
            ) : (
              <small>Waiting for the customer or a bank-account match.</small>
            )}
          </div>
        )}
      {order.paymentStatus === 'PAID' && order.paymentReference && (
        <div className="[&_small]:text-orderly-muted mt-4 grid gap-3 rounded-[10px] border border-[#d5c96c] bg-[#fffbe0] p-3">
          <strong>Payment verified manually</strong>
          <small>Bank reference: {order.paymentReference}</small>
          {order.paymentNote && <small>{order.paymentNote}</small>}
          {order.paymentSlip && (
            <button
              className="border-0 bg-transparent pl-0"
              disabled={busy}
              onClick={() => void viewSlip()}
            >
              View customer slip
            </button>
          )}
        </div>
      )}
      <ErrorNotice error={error} />
      <div className="flex flex-col gap-2">
        {order.paymentMethod &&
          order.paymentStatus === 'PENDING' &&
          order.status !== 'CANCELLED' && (
            <Action
              secondary
              disabled={busy}
              onClick={() => void update('payment')}
            >
              {order.paymentMethod === 'CASH'
                ? 'Cash received'
                : 'Confirm PromptPay'}
            </Action>
          )}
        {active && (
          <Action
            disabled={busy}
            onClick={() => void update(next[order.status]!)}
          >
            {labels[order.status]} →
          </Action>
        )}
        {active && order.paymentStatus !== 'PAID' && (
          <button
            className="border-0 bg-transparent pl-0 text-[#a8442c]"
            disabled={busy}
            onClick={() => void update('CANCELLED')}
          >
            Cancel order
          </button>
        )}
      </div>
      {detailed && order.paymentStatus === 'PAID' && (
        <section className="border-orderly-line mt-4 grid gap-3 border-t pt-[18px]">
          <div className="flex items-center justify-between gap-3">
            <h3>Manual refunds</h3>
            <Action
              secondary
              disabled={busy}
              onClick={() => void createRefund()}
            >
              Request refund
            </Action>
          </div>
          {order.refunds?.length ? (
            order.refunds.map((refund) => (
              <div
                className="border-orderly-line flex items-center justify-between gap-3 rounded-[10px] border p-3"
                key={refund.id}
              >
                <div>
                  <strong>{money(refund.amount)}</strong>{' '}
                  <Status value={refund.status} />
                  <small>
                    {refund.method.replace('_', ' ')} · {refund.reason}
                    {refund.reference ? ` · ${refund.reference}` : ''}
                  </small>
                </div>
                {refund.status === 'PENDING' && (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      className="border-0 bg-transparent pl-0"
                      disabled={busy}
                      onClick={() =>
                        void updateRefund(refund.id, refund.method, 'complete')
                      }
                    >
                      Mark money returned
                    </button>
                    <button
                      className="border-0 bg-transparent pl-0 text-[#a8442c]"
                      disabled={busy}
                      onClick={() =>
                        void updateRefund(refund.id, refund.method, 'cancel')
                      }
                    >
                      Cancel request
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <small>No refunds recorded for this order.</small>
          )}
          <small>
            Owners and managers complete or cancel refund requests after
            returning the money outside Orderly.
          </small>
        </section>
      )}
    </article>
  );
}
