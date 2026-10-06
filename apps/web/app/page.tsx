import Link from 'next/link';
export default function Home() {
  return (
    <main className="mx-auto max-w-[600px] px-[25px] py-[60px]">
      <div className="flex items-center gap-2.5 text-xs font-extrabold tracking-[1.3px]">
        <span className="bg-orderly-accent text-orderly-ink inline-grid size-8 place-items-center rounded-[9px] text-[23px]">
          ↗
        </span>{' '}
        ORDERLY
      </div>
      <div className="mt-[70px] text-[10px] font-bold tracking-[2px]">
        LIGHTWEIGHT RESTAURANT ORDERING
      </div>
      <h1 className="my-[30px] text-[clamp(48px,8vw,78px)] tracking-[-3px]">
        Scan. Order.
        <br />
        <em className="font-[Georgia,serif] font-normal">
          Keep service moving.
        </em>
      </h1>
      <p>
        Self-setup QR ordering for restaurants, bars, cafés, and food stalls.
        Run it on the phones, tablets, and browsers you already own.
      </p>
      <div className="border-orderly-line bg-orderly-surface my-5 rounded-[18px] border p-6">
        <h2>Your restaurant, ready in minutes.</h2>
        <p>
          Create a restaurant, choose your service style, add your menu, print
          QR codes, and open the live staff board.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Link
          className="border-orderly-green bg-orderly-green flex min-h-[50px] items-center justify-center gap-[15px] rounded-[11px] border px-5 py-3 text-[15px] font-semibold text-white no-underline hover:bg-[#163e2e]"
          href="/signup"
        >
          Create restaurant →
        </Link>
        <Link
          className="bg-orderly-surface text-orderly-green flex min-h-[50px] items-center justify-center gap-[15px] rounded-[11px] border border-[#bdcbbb] px-5 py-3 text-[15px] font-semibold no-underline"
          href="/staff/login"
        >
          Sign in
        </Link>
      </div>
      <footer className="text-orderly-muted py-[35px] text-[10px] tracking-[1px]">
        ONE SHARED PLATFORM · MADE FOR SMALL TEAMS
      </footer>
    </main>
  );
}
