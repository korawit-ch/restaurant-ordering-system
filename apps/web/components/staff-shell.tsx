'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { orderingApi } from '@repo/api-client';
import { ApiError, clientFetch } from '../lib/fetch/client';
import { ErrorNotice } from './shared';
export function StaffShell({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const router = useRouter(),
    path = usePathname(),
    cache = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => clientFetch(orderingApi.me()),
    retry: false,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace('/staff/login');
  }, [me.error, router]);
  if (!me.data)
    return (
      <main className="mx-auto w-full max-w-[1800px] p-10 max-[1100px]:p-7 max-[760px]:p-6 max-[760px]:px-4">
        <p>Checking access…</p>
        <ErrorNotice error={me.error} />
        <Link href="/staff/login">Sign in</Link>
      </main>
    );
  if (admin && !['OWNER', 'MANAGER'].includes(me.data.role || ''))
    return (
      <main className="mx-auto w-full max-w-[1800px] p-10 max-[1100px]:p-7 max-[760px]:p-6 max-[760px]:px-4">
        <h1>Manager access required</h1>
        <Link href="/staff/orders">Back to orders</Link>
      </main>
    );
  const links = [
    ['/staff/orders', 'Live orders'],
    ['/staff/sessions', 'Sessions'],
    ['/staff/history', 'History'],
    ['/staff/reports', 'Reports'],
    ...(me.data.role !== 'STAFF'
      ? [
          ['/admin/menu', 'Menu'],
          ['/admin/categories', 'Categories'],
          ['/admin/service-points', 'QR locations'],
          ['/admin/settings', 'Settings'],
          ['/admin/onboarding', 'Setup'],
          ['/admin/branches', 'Branches'],
          ['/admin/staff', 'Staff'],
        ]
      : []),
  ];
  return (
    <div className="flex min-h-screen max-[760px]:block">
      <aside className="fixed inset-y-0 left-0 flex w-[225px] flex-col bg-[#193a2e] px-[22px] py-[30px] text-[#fffef8] max-[1100px]:w-[190px] max-[1100px]:px-[15px] max-[1100px]:py-[25px] max-[760px]:relative max-[760px]:w-full max-[760px]:p-[18px]">
        <Link
          href="/staff/orders"
          className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]"
        >
          <span className="bg-orderly-accent text-orderly-ink inline-grid size-8 place-items-center rounded-[9px] text-[23px]">
            ↗
          </span>{' '}
          ORDERLY
        </Link>
        <div className="mt-[55px] mb-4 text-[9px] font-bold tracking-[2px] text-[#95b29e] max-[760px]:hidden">
          {me.data.memberships.find((m) => m.branchId === me.data?.branchId)
            ?.branchName || 'SERVICE'}
        </div>
        <nav className="flex flex-col gap-[5px] max-[760px]:mt-[18px] max-[760px]:flex-row max-[760px]:overflow-auto">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href!}
              className={`rounded-[10px] px-[15px] py-[13px] text-sm max-[760px]:px-[14px] max-[760px]:py-2.5 max-[760px]:whitespace-nowrap ${path === href ? 'bg-orderly-accent text-orderly-ink font-semibold' : 'text-[#c6d4ca]'}`}
            >
              {label}
            </Link>
          ))}
          {me.data.platformRole === 'OPERATOR' && (
            <Link
              href="/platform"
              className="rounded-[10px] px-[15px] py-[13px] text-sm text-[#c6d4ca]"
            >
              Platform
            </Link>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-[7px] pt-[30px] text-xs wrap-anywhere max-[760px]:mt-2.5 max-[760px]:flex-row max-[760px]:items-center max-[760px]:gap-3 max-[760px]:pt-0">
          <select
            aria-label="Active branch"
            value={me.data.branchId || ''}
            onChange={(e) => {
              const branchId = e.target.value;
              void clientFetch(orderingApi.context(branchId)).then(() => {
                cache.clear();
                window.location.href = '/staff/orders';
              });
            }}
          >
            {me.data.memberships.map((m) => (
              <option key={m.branchId} value={m.branchId}>
                {m.tenantName} · {m.branchName}
              </option>
            ))}
          </select>
          <span className="max-[760px]:flex-1">{me.data.email}</span>
          <small className="text-[#a6bba9] max-[760px]:hidden">
            {me.data.role}
          </small>
          <button
            className="mt-[15px] border-[#42614d] bg-transparent text-white max-[760px]:mt-0"
            onClick={() =>
              void clientFetch(orderingApi.logout()).then(() => {
                window.location.href = '/staff/login';
              })
            }
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="ml-[225px] min-w-0 flex-1 p-10 max-[1100px]:ml-[190px] max-[1100px]:p-7 max-[760px]:m-0 max-[760px]:p-6 max-[760px]:px-4">
        {children}
      </main>
    </div>
  );
}
