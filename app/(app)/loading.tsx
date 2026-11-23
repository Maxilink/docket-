/** Shown the moment a link is clicked, while the next page loads. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="h-4 w-40 animate-pulse rounded-full bg-primary-100" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded-xl bg-primary-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {['bg-primary-100', 'bg-hearing-soft', 'bg-filing-soft', 'bg-accent-soft'].map((c) => (
          <div key={c} className={`h-[92px] animate-pulse rounded-2xl ${c}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="h-72 min-w-0 flex-[999_1_520px] animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-72 min-w-0 flex-[1_1_300px] animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    </div>
  );
}
