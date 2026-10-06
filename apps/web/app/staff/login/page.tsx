'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { orderingApi } from '@repo/api-client';
import { clientFetch } from '../../../lib/fetch/client';
import { Action, ErrorNotice } from '../../../components/shared';
export default function Login() {
  const router = useRouter(),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-[600px] px-[25px] py-[60px]">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]"
      >
        ORDERLY
      </Link>
      <div className="mt-[26px] text-[10px] font-bold tracking-[2px]">
        STAFF ACCESS
      </div>
      <h1>Ready for service.</h1>
      <p>Sign in to manage orders, sessions, and payments.</p>
      <form
        className="border-orderly-line bg-orderly-surface mt-[30px] mb-5 rounded-[18px] border p-6 [&_button[type=submit]]:w-full"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const f = new FormData(e.currentTarget);
          void clientFetch(
            orderingApi.login(
              f.get('email') as string,
              f.get('password') as string,
            ),
          )
            .then((u) =>
              router.replace(
                u.platformRole === 'OPERATOR' && !u.branchId
                  ? '/platform'
                  : '/staff/orders',
              ),
            )
            .catch(setError)
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <ErrorNotice error={error} />
        <Action type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </Action>
      </form>
      <p>
        <Link href="/staff/forgot-password">Forgot password?</Link>
      </p>
      <p>
        <Link href="/signup">Create a restaurant</Link>
      </p>
    </main>
  );
}
