/* eslint-disable @next/next/no-img-element */
/** C-Diary logo. "lg" is the full wordmark (sign-in pages); "sm" is the mark with the name, for the sidebar. */
export default function Logo({ size = 'sm', firmName }: { size?: 'sm' | 'lg'; firmName?: string }) {
  if (size === 'lg') {
    return <img src="/brand/c-diary-logo.png" alt="C-Diary, court diary" width={246} height={81} className="h-auto w-[220px] sm:w-[246px]" />;
  }
  return (
    <span className="flex items-center gap-3">
      <img src="/brand/c-diary-mark.png" alt="" width={32} height={35} className="h-[35px] w-8" />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-tight text-primary">C-Diary</span>
        {firmName && <span className="text-xs text-muted">{firmName}</span>}
      </span>
    </span>
  );
}
