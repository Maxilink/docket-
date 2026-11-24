'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fromInputs } from '@/lib/time';
import { normalisePhone } from '@/lib/phone';
import { cleanEmail } from '@/lib/email';
import { clientChannels, sendToClient, type Attempt } from '@/lib/notify';
import { pushConfigured, pushProblem, sendPushToUser } from '@/lib/push';
import { canTextClients } from '@/lib/constants';
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

/** The signed-in person's id and role (approved members only). */
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as Role | null };
  const { data } = await supabase.from('profiles').select('role, status').eq('id', user.id).maybeSingle();
  const role = data && data.status === 'active' ? (data.role as Role) : null;
  return { supabase, user, role };
}

const MANUAL_TEXTS_PER_DAY = 3;

// ---------- Matters ----------
export async function saveMatter(formData: FormData): Promise<ActionResult> {
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  if (!title) return { error: 'Enter the case title, for example "Okafor v. Rivers State Government".' };
  const clientPhoneRaw = str(formData, 'client_phone');
  const clientPhone = clientPhoneRaw ? normalisePhone(clientPhoneRaw) : null;
  if (clientPhoneRaw && !clientPhone) return { error: 'The client phone number doesn\'t look right. Use a format like 0803 123 4567.' };
  const clientEmailRaw = str(formData, 'client_email');
  const clientEmail = clientEmailRaw ? cleanEmail(clientEmailRaw) : null;
  if (clientEmailRaw && !clientEmail) return { error: 'The client email address doesn\'t look right. Use a format like name@example.com.' };
  const row = {
    title,
    suit_number: str(formData, 'suit_number'),
    court: str(formData, 'court'),
    courtroom: str(formData, 'courtroom'),
    judge: str(formData, 'judge'),
    client_name: str(formData, 'client_name'),
    client_phone: clientPhone,
    client_email: clientEmail,
    opposing_counsel: str(formData, 'opposing_counsel'),
    lead_lawyer_id: str(formData, 'lead_lawyer_id'),
    description: str(formData, 'description'),
    status: str(formData, 'status') === 'closed' ? 'closed' : 'active',
  };
  const supabase = await createClient();
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

// ---------- Archive (instead of delete) ----------
export async function archiveMatter(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('archive_matter', { p_id: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/matters');
  revalidatePath('/archive');
  return {};
}

export async function archiveEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('archive_event', { p_id: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/today');
  revalidatePath('/archive');
  return {};
}

export async function restoreItem(kind: 'matter' | 'event', id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(kind === 'matter' ? 'restore_matter' : 'restore_event', { p_id: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/archive');
  return {};
}

export async function deleteForever(kind: 'matter' | 'event', id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_forever', { p_kind: kind, p_id: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/archive');
  return {};
}

// ---------- Events ----------
const TYPES: EventType[] = ['hearing', 'filing', 'client', 'internal', 'other'];

export async function saveEvent(formData: FormData): Promise<ActionResult> {
  const id = str(formData, 'id');
  const title = str(formData, 'title');
  const type = (str(formData, 'type') ?? 'hearing') as EventType;
  if (!TYPES.includes(type)) return { error: 'Pick an event type.' };
  const typeLabel = type === 'other' ? str(formData, 'type_label') : null;
  if (type === 'other' && !typeLabel) return { error: 'Say what kind of event this is, for example "Arbitration" or "Site visit".' };
  if (typeLabel && typeLabel.length > 60) return { error: 'Keep the event type under 60 characters.' };
  if (!title) return { error: 'Add a title so colleagues know what this is.' };
  const at = fromInputs(String(formData.get('date') ?? ''), String(formData.get('time') ?? ''));
  if (!at) return { error: 'Pick a date for the event.' };
  if (at.getTime() < Date.now()) return { error: 'That date and time has already passed. Pick a time in the future.' };
  const row = {
    type,
    type_label: typeLabel,
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
    const { user, role } = await me();
    notified = canTextClients(role)
      ? await notifyClient(eventId, String(formData.get('client_message') ?? ''), user?.id ?? null)
      : 'The outcome is saved. Clerks can\'t text clients, so no message was sent.';
  }
  revalidatePath('/today');
  return { id: (newId as string | null) ?? undefined, notified };
}

async function notifyClient(eventId: string, message: string, senderId: string | null): Promise<string> {
  const text = message.trim();
  if (!text) return 'No client message was sent because the message was empty.';
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from('events')
    .select('id, firm_id, starts_at, matter:matters(client_name, client_phone, client_email, suit_number), firm:firms(name)')
    .eq('id', eventId)
    .maybeSingle();
  const e = ev as unknown as { id: string; firm_id: string; starts_at: string; firm: { name: string } | null; matter: { client_name: string | null; client_phone: string | null; client_email: string | null; suit_number: string | null } | null } | null;
  if (!e || !e.matter) return 'The outcome is saved. No client message was sent because the case has no client email or phone number.';
  const reach = clientChannels({ email: e.matter.client_email, phone: e.matter.client_phone });
  if (!reach.count) {
    return e.matter.client_email || e.matter.client_phone
      ? 'The outcome is saved, but the client message was not sent: email (Brevo) and SMS (Termii) are not set up yet.'
      : 'The outcome is saved. No client message was sent because the case has no client email or phone number.';
  }
  const firmName = e.firm?.name ?? '';
  const results = await sendToClient(
    { email: e.matter.client_email, phone: e.matter.client_phone, name: e.matter.client_name, firmName },
    `Update on your case${e.matter.suit_number ? ` ${e.matter.suit_number}` : ''}`,
    text,
  );
  await logClient(results, { firm_id: e.firm_id, event_id: e.id, kind: 'client_update', sent_by: senderId, event_starts_at: e.starts_at });
  return summarise(results, 'The client update was sent', 'The outcome is saved, but the client message failed to send. Check your Brevo and Termii settings.');
}

/** Writes one reminder_log row per channel tried. Best-effort. */
async function logClient(results: Attempt[], base: { firm_id: string; event_id: string; kind: string; sent_by: string | null; event_starts_at: string | null }) {
  try {
    const admin = createAdminClient();
    if (results.length) {
      await admin.from('reminder_log').insert(results.map((r) => ({ ...base, channel: r.channel, recipient: r.recipient, status: r.ok ? 'sent' : 'failed', detail: r.detail })));
    }
  } catch {
    // Logging is best-effort.
  }
}

function summarise(results: Attempt[], okLead: string, allFailed: string) {
  const ok = results.filter((r) => r.ok).map((r) => (r.channel === 'email' ? 'email' : 'SMS'));
  const bad = results.filter((r) => !r.ok).map((r) => (r.channel === 'email' ? 'email' : 'SMS'));
  if (!ok.length) return allFailed;
  return `${okLead} by ${ok.join(' and ')}.${bad.length ? ` The ${bad.join(' and ')} didn't send.` : ''}`;
}

// ---------- Remind client now ----------
export async function remindClient(eventId: string, message: string): Promise<ActionResult & { at?: string; notice?: string }> {
  const text = message.trim();
  if (!text) return { error: 'Write the message to send.' };
  if (text.length > 900) return { error: 'Keep the message under 900 characters.' };
  const { supabase, user, role } = await me();
  if (!user) return { error: 'Please sign in again.' };
  if (!canTextClients(role)) return { error: 'Only admins, partners and associates can message clients.' };
  const { data: ev } = await supabase
    .from('events')
    .select('id, firm_id, starts_at, outcome, matter:matters(client_name, client_phone, client_email, suit_number), firm:firms(name)')
    .eq('id', eventId)
    .maybeSingle();
  if (!ev) return { error: 'Event not found.' };
  const e = ev as unknown as { id: string; firm_id: string; starts_at: string; outcome: string | null; firm: { name: string } | null; matter: { client_name: string | null; client_phone: string | null; client_email: string | null; suit_number: string | null } | null };
  if (new Date(e.starts_at).getTime() < Date.now() - 3600e3) return { error: 'This hearing has passed, so there is nothing to remind the client about.' };
  if (!e.matter?.client_email && !e.matter?.client_phone) return { error: 'This case has no client email or phone number. Add one on the matter first.' };
  const reach = clientChannels({ email: e.matter.client_email, phone: e.matter.client_phone });
  if (!reach.count) return { error: 'Email and SMS aren\'t set up yet. Add the Brevo or Termii keys in Vercel.' };
  const admin = createAdminClient();
  const { count: recent } = await admin
    .from('reminder_log')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', e.id)
    .eq('kind', 'client_manual')
    .eq('status', 'sent')
    .gte('created_at', new Date(Date.now() - 24 * 3600e3).toISOString());
  // Each reminder can go by email and SMS, so allow that many log rows per reminder.
  if ((recent ?? 0) >= MANUAL_TEXTS_PER_DAY * reach.count) return { error: `This client has already had ${MANUAL_TEXTS_PER_DAY} reminders about this hearing today. Try again tomorrow, or call them.` };
  const results = await sendToClient(
    { email: e.matter.client_email, phone: e.matter.client_phone, name: e.matter.client_name, firmName: e.firm?.name ?? '' },
    `Reminder: your case${e.matter.suit_number ? ` ${e.matter.suit_number}` : ''} is coming up`,
    text,
  );
  await logClient(results, { firm_id: e.firm_id, event_id: e.id, kind: 'client_manual', sent_by: user.id, event_starts_at: e.starts_at });
  if (!results.some((r) => r.ok)) return { error: 'The reminder didn\'t send. Check your Brevo and Termii settings, then try again.' };
  revalidatePath('/today');
  return { at: new Date().toISOString(), notice: summarise(results, 'Sent', '') };
}

// ---------- People ----------
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const fullName = str(formData, 'full_name');
  const phoneRaw = str(formData, 'phone');
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (!fullName) return { error: 'Enter your name.' };
  if (phoneRaw && !phone) return { error: 'That phone number doesn\'t look right. Use a format like 0803 123 4567.' };
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return {};
}

const ROLES: Role[] = ['admin', 'partner', 'associate', 'clerk'];

export async function setRole(userId: string, role: Role): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { error: 'Unknown role.' };
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return {};
}

/** Removes a member, or declines someone waiting to join. Removing someone also changes the join code. */
export async function removeMember(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_member', { p_user: userId });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return {};
}

export async function approveMember(userId: string, role: Role): Promise<ActionResult> {
  if (!ROLES.includes(role)) return { error: 'Unknown role.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_member', { p_user: userId, p_role: role });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return {};
}

// ---------- Push notifications ----------
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<ActionResult> {
  const { user, role } = await me();
  if (!user || !role) return { error: 'Please sign in again.' };
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return { error: 'This browser returned an invalid subscription.' };
  const admin = createAdminClient();
  // A device belongs to whoever signed in on it last.
  await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  const { error } = await admin.from('push_subscriptions').insert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) });
  if (error) return { error: 'Could not save this device. Try again.' };
  return {};
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return {};
}

export async function sendTestPush(): Promise<ActionResult & { reached?: number }> {
  const { user } = await me();
  if (!user) return { error: 'Please sign in again.' };
  if (!pushConfigured()) return { error: `Notifications aren't set up on the server yet. ${pushProblem()}` };
  const reached = await sendPushToUser(user.id, { title: 'C-Diary notifications are on', body: 'You\'ll get hearing reminders here, 1 day and 1 hour before.', url: '/today', tag: 'test' });
  if (!reached) return { error: 'No device received it. Switch notifications off and on again.' };
  return { reached };
}

export async function regenerateJoinCode(): Promise<ActionResult & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('regenerate_join_code');
  if (error) return { error: friendly(error.message) };
  revalidatePath('/team');
  return { code: data as string };
}

// ---------- Documents ----------
/** Deletes a case document and its file. The database only lets the uploader, partners and admins do this. */
export async function deleteDocument(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('documents').delete().eq('id', id).select('storage_path');
  if (error) return { error: friendly(error.message) };
  const row = (data ?? [])[0] as { storage_path: string } | undefined;
  if (!row) return { error: 'Only the person who uploaded it, a partner or an admin can delete this document.' };
  try {
    await createAdminClient().storage.from('matter-docs').remove([row.storage_path]);
  } catch {
    // The record is gone; a leftover file is harmless and private.
  }
  return {};
}

/** Turns the 7am list of today's matters on or off for the signed-in person. */
export async function setMorningList(on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.from('profiles').update({ morning_list: on }).eq('id', user.id);
  if (error) return { error: /morning_list/.test(error.message) ? 'Run update 005 in Supabase first.' : friendly(error.message) };
  return {};
}
