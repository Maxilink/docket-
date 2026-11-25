'use client';

/**
 * A date field that shows a hint while empty. iPhone Safari shows an empty date field as a blank box
 * with no placeholder, so the hint is drawn on top until a date is picked.
 */
export default function DateInput({
  id,
  value,
  onChange,
  placeholder = 'Choose a date',
  min,
  max,
  name,
  required,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  name?: string;
  required?: boolean;
}) {
  return (
    <span className="relative block min-w-0">
      <input
        id={id}
        name={name}
        type="date"
        className={`input date-pretty peer pr-10 ${value ? '' : 'text-transparent focus:text-ink'}`}
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 right-10 flex items-center truncate text-[16px] font-normal text-muted/70 peer-focus:hidden">
          {placeholder}
        </span>
      )}
      <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" />
      </svg>
    </span>
  );
}
