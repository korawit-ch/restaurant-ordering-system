'use client';
import { useQuery } from '@tanstack/react-query';
import { orderingApi } from '@repo/api-client';
import { clientFetch } from '../../lib/fetch/client';
import { StaffShell } from '../../components/staff-shell';
import { ErrorNotice } from '../../components/shared';
export default function Platform() {
  const q = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: () => clientFetch(orderingApi.platformTenants()),
  });
  return (
    <StaffShell>
      <h1>Platform tenants</h1>
      <p>
        Subscription and branch overview. Restaurant order data stays in its
        branch workspace.
      </p>
      <ErrorNotice error={q.error} />
      <div className="border-orderly-line bg-orderly-surface my-5 rounded-[18px] border p-6 px-[22px]">
        {q.data?.map((raw, i) => {
          const t = raw as {
            id: string;
            name: string;
            slug: string;
            status: string;
            _count: { branches: number };
            subscription?: { status: string; plan: { name: string } };
          };
          return (
            <div
              className="border-orderly-line flex items-center gap-5 border-b py-5 last:border-0 max-[760px]:flex-wrap max-[760px]:gap-2.5"
              key={t.id || i}
            >
              <strong className="flex flex-1 flex-col gap-[6px] max-[760px]:min-w-[130px]">
                {t.name}
                <small>{t.slug}</small>
              </strong>
              <span>{t._count.branches} branches</span>
              <span>{t.subscription?.plan.name}</span>
              <span>{t.subscription?.status}</span>
            </div>
          );
        })}
      </div>
    </StaffShell>
  );
}
