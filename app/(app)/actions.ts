'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fromInputs } from '@/lib/time';
import { normalisePhone } from '@/lib/phone';
import { sendMessage, termiiConfigured } from '@/lib/termii';
import type { ActionResult, EventType, Outcome, Role } from '@/lib/types';

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const clean = (m: string) => m.replace(/^.*?ERROR:\s*/i, '').replace(/\s*\(SQLSTATE.*$/, '');
const friendly = (m: string) => {
  const c = clean(m);
  if (/row-level security/i.test(c)) return 'You don\'t have permission to do that. Ask your firm admin.';
  return c;
};

// ---------- Matters ----------
export async function saveMatter(formData: FormData): Promise<ActionResult> {
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  if (!title) return { error: 'Enter the case title, for example "Okafor v. Rivers State Government".' };
  const clientPhoneRaw = str(formData, 'client_phone');
  const clientPhone = clientPhoneRaw ? normalisePhone(clientPhoneRaw) : null;
  if (clientPhoneRaw && !clientPhone) return { error: 'The client phone number doesn\'t look right. Use a format like 0803 123 4567.' };
  const row = {
    title,
    suit_number: str(formData, 'suit_number'),
    court: str(formData, 'court'),
    courtroom: str(formData, 'courtroom'),
    judge: str(formData, 'judge'),
    client_name: str(formData, 'client_name'),
    client_phone: clientPhone,
    opposing_counsel: str(formData, 'opposing_counsel'),
    lead_lawyer_id: str(formData, 'lead_lawyer_id'),
    description: str(formData, 'description'),
    status: str(formData, 'status') === 'closed' ? 'closed' : 'active',
  };
  const supabase = createClient();
  if (id) {
    const { error } = await supabase.from('matters').update(row).eq('id', id);
    if (error) return { error: friendly(error.message) };
    revalidatePath(`/matters/${id}`);
    return { id };
  }
  const { data, error } = await supabase.from('matters').insert(row).select('id').single();
  if (error) return { error: friendly(error.message) };
  revalidatePath('/matters');
  return { id: data?.id as string };
}

export async function deleteMatter(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error, count } = await supabase.from('matters').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  if (!count) return { error: 'Only partners and admins can delete a matter.' };
  revalidatePath('/matters');
  return {};
}

// ---------- Events ----------
const TYPES: EventType[] = ['hearing', 'filing', 'client', 'internal'];

export async function saveEvent(formData: FormData): Promise<ActionResult> {
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  const type = (str(formData, 'type') ?? 'hearing') as EventType;
  if (!TYPES.includes(type)) return { error: 'Pick an event type.' };
  if (!title) return { error: 'Add a title so colleagues know what this is.' };
  const at = fromInputs(String(formData.get('date') ?? ''), String(formData.get('time') ?? ''));
  if (!at) return { error: 'Pick a date for the event.' };
  if (at.getTime() < Date.now()) return { error: 'That date and time has already passed. Pick a time in the future.' };
  const row = {
    type,
    title,
    starts_at: at.toISOString(),
    matter_id: str(formData, 'matter_id'),
    purpose: str(formData, 'purpose'),
    court: str(formData, 'court'),
    courtroom: str(formData, 'courtroom'),
    lawyer_id: str(formData, 'lawyer_id'),
    notes: str(formData, 'notes'),
    remind_day: formData.get('remind_day') === 'on',
    remind_hour: formData.get('remind_hour') === 'on',
    remind_client: formData.get('remind_client') === 'on',
  };
  const supabase = createClient();
  if (id) {
    const { error } = await supabase.from('events').update(row).eq('id', id);
    if (error) return { error: friendly(error.message) };
    revalidatePath(`/events/${id}`);
    return { id };
  }
  const { data, error } = await supabase.from('events').insert(row).select('id').single();
  if (error) return { error: friendly(error.message) };
  return { id: data?.id as string };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error, count } = await supabase.from('events').delete({ count: 'exact' }).eq('id', id);
  if (error) return { error: friendly(error.message) };
  if (!count) return { error: 'Only partners and admins can delete events.' };
  return {};
}

// ---------- Record outcome ----------
const OUTCOMES: Outcome[] = ['adjourned', 'reserved', 'judgment', 'struck_out', 'settled', 'held', 'other'];

export async function recordOutcome(formData: FormData): Promise<ActionResult & { notified?: string }> {
  const eventId = str(formData, 'event_id');
  const outcome = str(formData, 'outcome') as Outcome | null;
  if (!eventId) return { error: 'Event not found.' };
  if (!outcome || !OUTCOMES.includes(outcome)) return { error: 'Pick what happened.' };
  const needsDate = outcome === 'adjourned' || outcome === 'reserved';
  let nextAt: Date | null = null;
  if (needsDate) {
    nextAt = fromInputs(String(formData.get('next_date') ?? ''), String(formData.get('next_time') ?? ''));
    if (!nextAt) return { error: 'Pick the next date.' };
    if (nextAt.getTime() <= Date.now()) return { error: 'The next date must be in the future.' };
  }
  const purpose = str(formData, 'next_purpose');
  const note = str(formData, 'note');
  const supabase = createClient();
  const { data: newId, error } = await supabase.rpc('record_outcome', {
    p_event_id: eventId,
    p_outcome: outcome,
    p_note: note,
    p_next_at: nextAt ? nextAt.toISOString() : null,
    p_next_purpose: purpose,
  });
  if (error) return { error: friendly(error.message) };

  let notified: string | undefined;
  if (formData.get('notify_client') === 'on') {
    notified = await notifyClient(eventId, String(formData.get('client_message') ?? ''));
  }
  revalidatePath('/today');
  return { id: (newId as string | null) ?? undefined, notified };
}

async function notifyClient(eventId: string, message: string): Promise<string> {
  const text = message.trim();
  if (!text) return 'No client message was sent because the message was empty.';
  if (!termiiConfigured()) return 'The outcome is saved, but the client message was not sent: Termii is not set up yet.';
  const supabase = createClient();
  const { data: ev } = await supabase.from('events').select('id, firm_id, matter:matters(client_phone)').eq('id', eventId).maybeSingle();
  const matter = (ev as unknown as { matter: { client_phone: string | null } | null } | null)?.matter;
  const to = normalisePhone(matter?.client_phone ?? null);
  if (!ev || !to) return 'The outcome is saved. No client message was sent because the case has no client phone number.';
  const res = await sendMessage(to, text);
  try {
    const admin = createAdminClient();
    await admin.from('reminder_log').insert({ firm_id: ev.firm_id, event_id: ev.id, kind: 'client_update', channel: res.channel, recipient: to, status: res.ok ? 'sent' : 'failed', detail: res.detail });
  } catch {
    // Logging is best-effort.
  }
  return res.ok ? 'The client update was sent.' : 'The outcome is saved, but the client message failed to send. Check your Termii balance and sender ID.';
}

// ---------- Remind client now ----------
export async function remindClient(eventId: string, message: string): Promise<ActionResult & { at?: string }> {
  const text = message.trim();
  if (!text) return { error: 'Write the message to send.' };
  if (text.length > 900) return { error: 'Keep the message under 900 characters.' };
  const supabase = createClient();
  const { data: ev } = await supabase
    .from('events')
    .select('id, firm_id, starts_at, outcome, matter:matters(client_phone)')
    .eq('id', eventId)
    .maybeSingle();
  if (!ev) return { error: 'Event not found.' };
  const e = ev as unknown as { id: string; firm_id: string; starts_at: string; outcome: string | null; matter: { client_phone: string | null } | null };
  if (new Date(e.starts_at).getTime() < Date.now() - 3600e3) return { error: 'This hearing has passed, so there is nothing to remind the client about.' };
  const to = normalisePhone(e.matter?.client_phone ?? null);
  if (!to) return { error: 'This case has no client phone number. Add one on the matter first.' };
  if (!termiiConfigured()) return { error: 'SMS and WhatsApp aren\'t set up yet. Add the Termii keys in Vercel.' };
  const res = await sendMessage(to, text);
  try {
    const admin = createAdminClient();
    await admin.from('reminder_log').insert({ firm_id: e.firm_id, event_id: e.id, kind: 'client_manual', channel: res.channel, recipient: to, status: res.ok ? 'sent' : 'failed', detail: res.detail });
  } catch {
    // Logging is best-effort.
  }
  if (!res.ok) return { error: 'The message didn\'t send. Check your Termii balance and sender ID, then try again.' };
  revalidatePath('/today');
  return { at: new Date().toISOString() };
}

// ---------- People ----------
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const fullName = str(formData, 'full_name');
  const phoneRaw = str(formData, 'phone');
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (!fullName) return { error: 'Enter your name.' };
  if (phoneRaw && !phone) return { error: 'That phone number doesn\'t look right. Use a format like 0803 123 4567.' };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/', 'layout');
  return {};
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const pw = String(formData.get('password') ?? '');
  if (pw.length < 8) return { error: 'Use a password of at least 8 characters.' };
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return {};
}

const ROLES: Role[] = ['admin', 'partner', 'associate', 'clerk'];

export async function setRole(userId: string, role: Role): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { error: 'Unknown role.' };
  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return {};
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ firm_id: null }).eq('id', userId);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return {};
}

export async function regenerateJoinCode(): Promise<ActionResult & { code?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('regenerate_join_code');
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return { code: data as string };
}
