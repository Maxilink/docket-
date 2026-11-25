'use client';
import { useState, useTransition } from 'react';
import { savePlan } from '../actions';
import type { Plan } from '@/lib/billing';

const INTERVALS = [
  { months: 1, label: 'Monthly' },
  { months: 3, label: 'Every 3 months' },
  { months: 6, label: 'Every 6 months' },
  { months: 12, label: 'Yearly' },
];

export default function PlanEditor({ plan }: { plan?: Plan }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [price, setPrice] = useState(plan ? String(plan.price_kobo / 100) : '');
  const [months, setMonths] = useState(plan?.interval_months ?? 1);
  const [maxUsers, setMaxUsers] = useState(plan?.max_users ? String(plan.max_users) : '');
  const [active, setActive] = useState(plan?.active ?? true);
  const [sort, setSort] = useState(String(plan?.sort ?? 0));
  const key = plan?.id ?? 'new';

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await savePlan({
        id: plan?.id,
        name,
        description,
        priceNaira: Number(price),
        intervalMonths: months,
        maxUsers: maxUsers ? Number(maxUsers) : null,
        active,
        sort: Number(sort) || 0,
      });
      setMsg(r);
      if (r.ok && !plan) { setName(''); setDescription(''); setPrice(''); setMaxUsers(''); }
    });
  }

  return (
    <form onSubmit={save} className={`card flex flex-col gap-3 p-5 ${plan ? '' : 'border-dashed'}`}>
      <h2 className="font-display text-lg font-bold">{plan ? plan.name : 'Add a plan'}</h2>
      <label className="field" htmlFor={`pn-${key}`}>Name
        <input id={`pn-${key}`} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Chambers" required />
      </label>
      <label className="field" htmlFor={`pd-${key}`}>What it includes
        <input id={`pd-${key}`} className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="e.g. Up to 10 users, AI summaries and drafting" />
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <label className="field" htmlFor={`pp-${key}`}>Price (₦)
          <input id={`pp-${key}`} className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="25000" required />
        </label>
        <label className="field" htmlFor={`pi-${key}`}>Billed
          <select id={`pi-${key}`} className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {INTERVALS.map((i) => <option key={i.months} value={i.months}>{i.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <label className="field" htmlFor={`pu-${key}`}>Most users
          <input id={`pu-${key}`} className="input" inputMode="numeric" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value.replace(/\D/g, ''))} placeholder="Unlimited" />
        </label>
        <label className="field" htmlFor={`ps-${key}`}>Order on page
          <input id={`ps-${key}`} className="input" inputMode="numeric" value={sort} onChange={(e) => setSort(e.target.value.replace(/[^\d-]/g, ''))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-primary" /> On sale
      </label>
      {(msg.ok || msg.error) && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.error ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent-ink'}`}>{msg.error ?? msg.ok}</p>}
      <button type="submit" className="btn-primary self-start" disabled={pending}>{pending ? 'Saving…' : plan ? 'Save changes' : 'Add plan'}</button>
    </form>
  );
}
