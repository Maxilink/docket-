/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: { absolute: 'C-Diary: the court diary for Nigerian law firms' },
  description:
    'Hearings, adjournments, filing deadlines and reminders for your whole chambers. Record what happened in court, fix the next date, and remind counsel and clients by email, SMS and WhatsApp.',
};

export const dynamic = 'force-dynamic';

/*
  Titles use BR Sonoma. It is a licensed font, so it is not bundled here:
  put the .woff2 files from your licence in public/fonts/ with the names below.
  Until then, titles fall back to Plus Jakarta Sans. Body text uses the system font.
*/
const PAGE_CSS = `
@font-face{font-family:'BR Sonoma';src:local('BR Sonoma SemiBold'),local('BRSonoma-SemiBold'),url('/fonts/BRSonoma-SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
@font-face{font-family:'BR Sonoma';src:local('BR Sonoma Bold'),local('BRSonoma-Bold'),url('/fonts/BRSonoma-Bold.woff2') format('woff2');font-weight:700;font-display:swap}
.lp{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.lp-title{font-family:'BR Sonoma',var(--font-sans,'Plus Jakarta Sans'),system-ui,sans-serif;text-wrap:balance}
.lp-hero{background:radial-gradient(1200px 500px at 50% -10%,#5B1BB8 0%,transparent 70%),linear-gradient(180deg,#2E0562 0%,#3A0A7E 100%)}
.lp-shot{box-shadow:0 40px 80px -30px rgba(20,2,50,.55),0 0 0 1px rgba(255,255,255,.14)}
@keyframes lpUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.lp-rise{animation:lpUp .8s cubic-bezier(.2,.8,.2,1) .15s both}
@media (prefers-reduced-motion:reduce){.lp-rise{animation:none}}
.lp-panel{display:none}
#role-counsel:checked~.lp-panels .p-counsel,#role-clerks:checked~.lp-panels .p-clerks,#role-partners:checked~.lp-panels .p-partners{display:grid}
#role-counsel:checked~.lp-tabs label[for=role-counsel],#role-clerks:checked~.lp-tabs label[for=role-clerks],#role-partners:checked~.lp-tabs label[for=role-partners]{background:#2E0562;color:#fff;box-shadow:0 8px 20px -10px rgba(46,5,98,.8)}
#role-counsel:focus-visible~.lp-tabs label[for=role-counsel],#role-clerks:focus-visible~.lp-tabs label[for=role-clerks],#role-partners:focus-visible~.lp-tabs label[for=role-partners]{outline:2px solid #0ECED4;outline-offset:2px}
`;

const ROLES = [
  {
    id: 'counsel',
    tab: 'For counsel',
    title: 'Walk into court knowing exactly what’s on',
    points: [
      'Your hearings for the day by email and WhatsApp at 7am, with anything not yet packed',
      'Reminders a day before and within the hour, by email, SMS, WhatsApp or phone notification',
      'Record the outcome and fix the next date in one step',
      'AI summaries of processes, rulings and written addresses',
    ],
    shot: { src: '/landing/today.jpg', alt: 'The Today screen in C-Diary, showing events today, hearings this week, filing deadlines and matters with no next date' },
  },
  {
    id: 'clerks',
    tab: 'For clerks and secretaries',
    title: 'Keep the whole chambers’ diary in one place',
    points: [
      'A shared month calendar, with a preview of each day on hover',
      'A printable weekly cause list for the noticeboard',
      'A bring-to-court checklist on every hearing',
      'Clients reminded of their dates by email and SMS the day before',
    ],
    shot: { src: '/landing/calendar.jpg', alt: 'The C-Diary calendar for November, with a hover preview of a court hearing on Friday 13 November' },
  },
  {
    id: 'partners',
    tab: 'For partners and admins',
    title: 'See that nothing slips, without chasing anyone',
    points: [
      'Past hearings with no outcome recorded are flagged on Today',
      'Active matters with no next date are flagged too',
      'Approve each new member of staff before they get in',
      'An activity log of every change to every matter',
    ],
    shot: null,
  },
] as const;

const FEATURES = [
  { title: 'Firm calendar', body: 'Month view with hover previews, filters by type, and the whole firm or just your matters.', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { title: 'Reminders that reach people', body: 'Email first, then SMS and WhatsApp through Termii (including the DND route), plus phone notifications and an alarm sound.', icon: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0' },
  { title: 'Printable cause list', body: 'A clean weekly list for the noticeboard, with each hearing’s readiness.', icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { title: 'Documents and AI summaries', body: 'Every process and exhibit filed under its matter and hearing, with a one-click summary.', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4' },
  { title: 'Team messages', body: 'A discussion for every matter, a firm-wide channel and direct messages. Clients never see them.', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { title: 'Private to your firm', body: 'Each firm’s matters and files are walled off at the database level, with roles for every member.', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
];

const LOCAL = [
  { title: 'Times in WAT', body: 'Every date and reminder runs on Lagos time.' },
  { title: 'Suit numbers and courts', body: 'Matters carry suit numbers, courts and courtrooms.' },
  { title: 'DND-safe SMS', body: 'Reminders still reach lines with Do Not Disturb on.' },
  { title: 'Email and WhatsApp', body: 'The morning list lands in the inbox and on WhatsApp, where your team already reads.' },
];

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-white' : ''}`}>
        <img src="/brand/c-diary-mark.png" alt="" width={30} height={30} className="h-[24px] w-auto" />
      </span>
      <span className={`lp-title text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-primary'}`}>C-Diary</span>
    </span>
  );
}

function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-xl bg-white ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-primary-100 bg-[#F4F0FA] px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]" />
        <span className="ml-3 hidden truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-muted sm:block">c-diary.vercel.app</span>
      </div>
      <img src={src} alt={alt} width={1600} height={850} className="block h-auto w-full" />
    </figure>
  );
}

export default async function Landing() {
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }

  const cta = signedIn
    ? { href: '/today', label: 'Open my diary' }
    : { href: '/login?mode=signup', label: 'Create your firm’s diary' };

  return (
    <div className="lp min-h-screen bg-[#FBF9FE] text-ink">
      <style>{PAGE_CSS}</style>

      {/* Hero */}
      <section className="lp-hero relative overflow-hidden text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.55) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(180deg,#000 0%,transparent 75%)', WebkitMaskImage: 'linear-gradient(180deg,#000 0%,transparent 75%)' }} />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <Link href="/" aria-label="C-Diary home" className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <Brand light />
          </Link>
          <nav aria-label="Page sections" className="hidden items-center gap-7 text-[15px] text-white/80 md:flex">
            <a href="#roles" className="hover:text-white">Who it’s for</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#ai" className="hover:text-white">AI summaries</a>
            <a href="#start" className="hover:text-white">Getting started</a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/today" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-accent-300">Open my diary</Link>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Sign in</Link>
                <Link href="/login?mode=signup" className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-accent-300 sm:px-5">Create account</Link>
              </>
            )}
          </div>
        </header>

        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-12 text-center sm:px-8 md:pt-20">
          <h1 className="lp-title text-[clamp(2.3rem,6.2vw,4.5rem)] font-bold leading-[1.06] tracking-[-0.03em]">
            <span className="block md:whitespace-nowrap">Never miss a court date</span>
            <span className="block text-accent md:whitespace-nowrap">or a filing deadline</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
            Hearings, filing deadlines and next dates for your whole chambers in one diary. Record what happened in court,
            fix the next date in one step, and let counsel and clients be reminded by email, SMS and WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={cta.href} className="rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-primary shadow-[0_12px_30px_-12px_rgba(14,206,212,.8)] transition hover:-translate-y-0.5 hover:bg-accent-300">{cta.label}</Link>
            {!signedIn && <Link href="/login" className="rounded-full border border-white/35 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">Sign in</Link>}
          </div>
          <p className="mt-4 text-sm text-white/60">Create your firm, then invite colleagues with a join code.</p>
        </div>

        {/* Screens */}
        <div className="lp-rise relative z-10 mx-auto max-w-6xl px-4 sm:px-8">
          <div className="relative mx-auto max-w-5xl">
            <Shot src="/landing/today.jpg" alt="The Today screen in C-Diary" className="lp-shot relative z-10 translate-y-0" />
            <div className="absolute -left-10 bottom-[18%] z-20 hidden w-[34%] lg:block">
              <Shot src="/landing/calendar.jpg" alt="The C-Diary month calendar" className="lp-shot" />
            </div>
            <div className="absolute -right-8 top-[16%] z-20 hidden w-[290px] rounded-2xl bg-white p-4 text-left text-ink shadow-[0_24px_50px_-20px_rgba(10,113,120,.6)] md:block">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-accent-ink">
                  <Icon d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" className="h-4 w-4" />
                  WhatsApp
                </span>
                <span className="text-muted">7:00 am</span>
              </div>
              <p className="text-[13px] leading-snug">Good morning Ada. Today: 9:00 am Okafor v. Rivers State Govt, High Court, Court 4, for continuation of hearing. 2 items not ready.</p>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-0 h-[22%] bg-[#FBF9FE]" />
      </section>

      <main>
        {/* Made for Nigerian courts */}
        <section aria-labelledby="local" className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 id="local" className="lp-title text-center text-2xl font-bold tracking-tight text-primary sm:text-3xl">Made for how Nigerian courts work</h2>
            <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {LOCAL.map((l) => (
                <li key={l.title} className="text-center">
                  <p className="lp-title text-lg font-bold text-ink">{l.title}</p>
                  <p className="mt-1 text-muted">{l.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" aria-labelledby="roles-h" className="bg-[#F1EAFB] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="roles-h" className="lp-title text-3xl font-bold tracking-tight text-primary sm:text-[2.6rem] sm:leading-[1.1]">One diary for everyone in chambers</h2>
              <p className="mt-3 text-lg text-muted">Counsel, clerks and partners each get the view they need from the same shared diary.</p>
            </div>

            <div className="mt-10">
              <input type="radio" name="role" id="role-counsel" className="sr-only" defaultChecked />
              <input type="radio" name="role" id="role-clerks" className="sr-only" />
              <input type="radio" name="role" id="role-partners" className="sr-only" />
              <div className="lp-tabs mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full bg-white p-1.5 shadow-sm">
                {ROLES.map((r) => (
                  <label key={r.id} htmlFor={`role-${r.id}`} className="cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-50 sm:px-5">
                    {r.tab}
                  </label>
                ))}
              </div>

              <div className="lp-panels mt-10">
                {ROLES.map((r) => (
                  <div key={r.id} className={`lp-panel p-${r.id} grid-cols-[minmax(0,1fr)] items-center gap-10 rounded-[28px] bg-white p-6 shadow-[0_30px_60px_-40px_rgba(46,5,98,.5)] sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
                    <div>
                      <h3 className="lp-title text-2xl font-bold tracking-tight text-ink sm:text-3xl">{r.title}</h3>
                      <ul className="mt-6 space-y-3">
                        {r.points.map((p) => (
                          <li key={p} className="flex gap-3 text-[16px] leading-relaxed">
                            <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                      <Link href={cta.href} className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700">{cta.label}</Link>
                    </div>
                    {r.shot ? (
                      <Shot src={r.shot.src} alt={r.shot.alt} className="border border-primary-100 shadow-[0_20px_40px_-24px_rgba(46,5,98,.45)]" />
                    ) : (
                      <div className="rounded-2xl border border-primary-100 bg-[#FBF9FE] p-5 sm:p-6">
                        <p className="lp-title text-lg font-bold text-ink">Needs attention</p>
                        <ul className="mt-4 divide-y divide-primary-100">
                          {[
                            ['Awaiting outcome', 'State v. Ibe & 2 Ors, sat on 19 Nov', 'bg-[#FDF3D7] text-[#8A5A00]'],
                            ['No next date', 'Eze Holdings v. Zenmark Bank', 'bg-primary-100 text-primary'],
                            ['Waiting for approval', 'Chiamaka Obi, clerk', 'bg-accent-soft text-accent-ink'],
                          ].map(([tag, text, tone]) => (
                            <li key={text} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                              <span className="font-medium">{text}</span>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{tag}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-xs text-muted">Example entries.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AI */}
        <section id="ai" aria-labelledby="ai-h" className="py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 sm:px-8 lg:grid-cols-2">
            <div>
              <h2 id="ai-h" className="lp-title text-3xl font-bold tracking-tight text-primary sm:text-[2.6rem] sm:leading-[1.1]">Read the file before you’ve opened it</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                Upload a writ, a ruling or a 40-page written address, even a phone photo of a served process. The AI summary sets out
                what it is, who the parties are, the key points, the dates and deadlines, and what to do next. You check it against the
                document; it saves you the first read.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {['PDFs, including scans', 'Word documents', 'Photos of documents', 'Saved for the whole team'].map((x) => (
                  <li key={x} className="flex items-center gap-2.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-accent-ink">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-primary-200 bg-white p-5 shadow-[0_24px_50px_-28px_rgba(46,5,98,0.45)] sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-hearing-soft text-[11px] font-bold text-hearing">PDF</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">Statement of claim, Okafor v. Rivers State.pdf</p>
                  <p className="text-[13px] text-muted">18 pages, uploaded by Barr. Tunde</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-primary-50 p-4 text-[15px] leading-relaxed">
                <p className="font-bold text-primary-600">What this is</p>
                <p className="mb-3">The claimant’s statement of claim for declaration of title to land at Rumuokoro and damages for trespass.</p>
                <p className="font-bold text-primary-600">Dates and deadlines</p>
                <ul className="ml-5 list-disc">
                  <li>Served 3 March 2026</li>
                  <li>Defence due within the time set by the court rules: confirm the date</li>
                </ul>
              </div>
              <p className="mt-3 text-xs text-muted">Example summary. AI summaries are a reading aid; always check them against the document.</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-h" className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 id="features-h" className="lp-title mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-primary sm:text-[2.6rem] sm:leading-[1.1]">Everything a litigation practice runs on</h2>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-2xl border border-primary-100 bg-[#FBF9FE] p-6 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_20px_40px_-28px_rgba(46,5,98,.5)]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-accent"><Icon d={f.icon} /></span>
                  <h3 className="lp-title mt-4 text-lg font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Getting started */}
        <section id="start" aria-labelledby="start-h" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="lp-hero grid grid-cols-[minmax(0,1fr)] items-center gap-10 overflow-hidden rounded-[28px] px-6 py-12 text-white sm:px-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 id="start-h" className="lp-title text-3xl font-bold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">Get your chambers set up in minutes</h2>
                <ol className="mt-8 space-y-5">
                  {[
                    ['Create your firm', 'Sign up and name your firm. You become its admin.'],
                    ['Invite your team', 'Share the join code. You approve each colleague before they get in.'],
                    ['Add your matters', 'Enter each case and its next date. Reminders start straight away.'],
                  ].map(([t, b], i) => (
                    <li key={t} className="flex gap-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-bold text-primary">{i + 1}</span>
                      <div>
                        <h3 className="font-bold">{t}</h3>
                        <p className="mt-0.5 text-white/75">{b}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href={cta.href} className="rounded-full bg-accent px-7 py-3.5 font-semibold text-primary transition hover:bg-accent-300">{cta.label}</Link>
                  {!signedIn && <Link href="/login" className="rounded-full border border-white/35 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">Sign in</Link>}
                </div>
              </div>
              <Shot src="/landing/calendar.jpg" alt="The C-Diary month calendar" className="lp-shot hidden lg:block lg:translate-x-16 lg:scale-110" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#1A0338] text-white/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Brand light />
            <p className="mt-4 max-w-sm">The court diary for Nigerian law firms. All times are shown in West Africa Time.</p>
          </div>
          <nav aria-label="Product">
            <p className="font-semibold text-white">Product</p>
            <ul className="mt-3 space-y-2">
              <li><a href="#roles" className="hover:text-white">Who it’s for</a></li>
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#ai" className="hover:text-white">AI summaries</a></li>
            </ul>
          </nav>
          <nav aria-label="Account">
            <p className="font-semibold text-white">Account</p>
            <ul className="mt-3 space-y-2">
              {signedIn ? (
                <li><Link href="/today" className="hover:text-white">Open my diary</Link></li>
              ) : (
                <>
                  <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
                  <li><Link href="/login?mode=signup" className="hover:text-white">Create account</Link></li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
