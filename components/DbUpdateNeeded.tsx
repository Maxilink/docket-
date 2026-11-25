/** Shown instead of a "not found" page when a database query fails, usually because an update hasn't been run in Supabase. */
export default function DbUpdateNeeded({ message }: { message: string }) {
  const missing = /column|does not exist|relation|schema cache/i.test(message);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-6 text-warn">
      <h1 className="font-display text-xl font-bold">This page couldn&apos;t load</h1>
      {missing ? (
        <p>
          The database is missing a recent update. In Supabase, open SQL Editor and run the update files in order
          (006, then 007, then 008), then reload this page. Running a file twice does no harm.
        </p>
      ) : (
        <p>Something went wrong reading this page. Reload to try again.</p>
      )}
      <p className="font-mono text-xs opacity-80">{message}</p>
    </div>
  );
}
