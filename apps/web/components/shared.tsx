'use client';
import { Button } from '@repo/ui/button';
import type { ReactNode } from 'react';
export function Action({
  children,
  onClick,
  disabled = false,
  type = 'button',
  secondary = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  secondary?: boolean;
}) {
  return (
    <Button
      variant={secondary ? 'secondary' : 'primary'}
      className={`flex min-h-[50px] items-center justify-center gap-[15px] rounded-[11px] border px-5 py-3 text-[15px] font-semibold ${secondary ? 'bg-orderly-surface text-orderly-green hover:bg-orderly-bg border-[#bdcbbb]' : 'border-orderly-green bg-orderly-green text-white hover:bg-[#163e2e]'}`}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
export function money(value: string | number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
export function ErrorNotice({ error }: { error: unknown }) {
  return error ? (
    <div
      role="alert"
      className="my-[15px] rounded-xl border border-[#edb5a3] bg-[#ffe7df] p-[14px] text-[#882e1b]"
    >
      {error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Something went wrong. Please try again.'}
    </div>
  ) : null;
}
export function Status({ value }: { value: string }) {
  const colors: Record<string, string> = {
    NEW: 'bg-[#e7efa9] text-[#455419]',
    PAID: 'bg-[#deeee3] text-[#24543a]',
    SERVED: 'bg-[#deeee3] text-[#24543a]',
    ACTIVE: 'bg-[#deeee3] text-[#24543a]',
    COMPLETED: 'bg-[#deeee3] text-[#24543a]',
    READY: 'bg-[#deeee3] text-[#24543a]',
    PENDING: 'bg-[#fae4bc] text-[#80571c]',
    PREPARING: 'bg-[#fae4bc] text-[#80571c]',
    CANCELLED: 'bg-[#f6ded9] text-[#9b3f2e]',
    FAILED: 'bg-[#f6ded9] text-[#9b3f2e]',
    INACTIVE: 'bg-[#f6ded9] text-[#9b3f2e]',
    ACCEPTED: 'bg-[#dfe9f5] text-[#3e587a]',
  };
  return (
    <span
      className={`rounded-md px-[9px] py-[6px] text-[10px] font-bold tracking-[0.6px] whitespace-nowrap ${colors[value] || 'bg-[#e9ece5] text-[#596750]'}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}
