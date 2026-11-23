# C-Diary

Court diary and case tracker for law firms: hearings, adjournments, filing deadlines, case files, and SMS/WhatsApp reminders.

**Stack:** Next.js 14 (React, TypeScript) · Tailwind CSS · Supabase (database, logins) · Termii (SMS/WhatsApp) · Vercel (hosting)

**Brand colours (from the logo):** deep purple `#2E0562`, violet `#4F05AD` and cyan `#0ECED4`. Cyan is used for fills and highlights. A darker `#0A7178` is used where it appears as small text, so it stays readable on white. Typeface: Plus Jakarta Sans. Logo files are in `public/brand/` and app icons in `public/icons/`.

---

## What's in version 1

- **Logins and firms.** The first person creates the firm and becomes Admin. Colleagues ask to join with the firm's join code, and the Admin approves them and picks their role on the Team page. Until then they see nothing. The join code changes automatically when someone is removed, and 10 wrong codes in an hour block further tries. Each firm's data is walled off from every other firm's at the database level, including links between records.
- **Roles:** Admin, Partner, Associate, Clerk. Admins and Partners can archive and restore and see the activity log. Only Admins manage staff and delete permanently. Clerks can't text clients.
- **Archive instead of delete.** Archived matters (with their dates and discussion) and events disappear from the diary and get no reminders. Restore them from **Team > Archive**. Admins can delete permanently from there.
- **Activity log.** Who added, moved, archived, restored or deleted what, outcomes recorded, client texts sent, and staff approvals and removals. **Team > Activity log**, for partners and admins.
- **Today:** cause list, events awaiting an outcome, matters with no next date, filing deadlines, and the messages sent. Switch between "My matters" and "Whole firm".
- **Calendar:** month view with type filters. Hover over a day to preview its events, and double-click a future day to add one.
- **Matters (case files):** suit number, court, judge, client, counsel, and the full proceedings history.
- **Events:** hearings, filing deadlines, client and internal meetings, with a warning when a lawyer is double-booked.
- **Record outcome:** after a hearing, pick what happened (adjourned, ruling reserved, judgment, struck out, settled). The app creates the next hearing and can send the client an SMS/WhatsApp update.
- **Past events are locked.** Their details can't be edited, but their outcome can still be recorded. The database enforces this, not just the screen.
- **Reminders:**
  - SMS/WhatsApp and a push notification to counsel 1 day and 1 hour before
  - optionally an SMS/WhatsApp to the client the day before
  - an in-app alarm sound while the app is open
  - nothing automatic between 8pm and 7am; due reminders go out at 7am
  - a rescheduled hearing gets fresh reminders for its new date; a failed text is retried up to 3 times
- **Messages:** private chat for counsel and staff, with a firm-wide General channel, a discussion for each matter, and direct messages between two people. New messages appear live, and the sidebar shows an unread count.
- **Remind client:** from Today, a case file or an event, send the client an SMS/WhatsApp reminder that their matter is coming up. The message is pre-written and can be edited before sending. Admins, partners and associates only, at most 3 per hearing per day, and each one is logged with who sent it.
- **Installable app:** on a phone, open the site and choose "Add to Home Screen" (iPhone: Share > Add to Home Screen; Android: Install app). Today, Calendar and Matters open offline once visited. Switch on notifications under **My account**. On iPhone, notifications need iOS 16.4 or later and the app opened from the Home Screen.

All times are Nigerian time (WAT).

---

## Setup: about 30 minutes, once

### 1. Supabase: create the database

1. Open your Supabase project and go to **SQL Editor** > **New query**.
2. Paste the whole of `supabase/schema.sql` and click **Run**. You should see "Success".
   Then open a new query, paste `supabase/002_messages_and_reminders.sql` and click **Run**. This adds Messages and Remind client.
   Then do the same with `supabase/003_security_archive_reminders.sql`. This adds approvals, the archive, the activity log, safer reminders and push notifications.
3. Go to **Project Settings** > **API** and copy three values:
   - Project URL
   - `anon` `public` key
   - `service_role` key: keep this one secret
4. Go to **Authentication** > **URL Configuration**:
   - **Site URL:** your Vercel address (from step 2), for example `https://docket-xyz.vercel.app`
   - **Redirect URLs:** add `https://docket-xyz.vercel.app/auth/callback`

   You can fill these in after step 2.
5. Optional: for a faster pilot, go to **Authentication** > **Providers** > **Email** and turn off **Confirm email**, so staff can sign in straight away.

### 2. Vercel: put the app online

1. Put this folder on GitHub: create a private repository and upload the files. Do not upload `.env` files.
2. In Vercel, click **Add New** > **Project** and import that repository. The framework is detected as Next.js.
3. Before deploying, open **Environment Variables** and add each entry from `.env.example`:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
   | `CRON_SECRET` | Any long random string you make up |
   | `TERMII_API_KEY` | From the Termii dashboard |
   | `TERMII_BASE_URL` | `https://v4.api.termii.com` |
   | `TERMII_SENDER_ID` | Your approved Sender ID |
   | `TERMII_CHANNEL` | `dnd` (ask Termii to activate the DND route), or `generic` while you wait |
   | `NEXT_PUBLIC_APP_NAME` | `C-Diary` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notifications: public key (see below) |
   | `VAPID_PRIVATE_KEY` | Push notifications: private key. Keep secret |
   | `VAPID_SUBJECT` | `mailto:` plus an email address for your firm, e.g. `mailto:it@yourfirm.com` |

   To create the two VAPID keys, run this once on your computer and copy the two values it prints:

   ```bash
   npx web-push generate-vapid-keys
   ```

4. Click **Deploy**, then copy your site address.
5. Go back to Supabase step 4 and enter that address.

### 3. Termii: sender ID and route

1. In Termii, request a **Sender ID** (for example your firm or product name) and wait for approval.
2. Ask Termii support to activate the **DND route**. Court reminders are transactional, and the `generic` route doesn't reach DND numbers or MTN numbers between 8pm and 8am.
3. Fund your Termii wallet.

To send by WhatsApp instead of SMS, set `TERMII_CHANNEL=whatsapp` and `TERMII_SENDER_ID` to your Termii WhatsApp device name. This needs WhatsApp set up on your Termii account.

### 4. Turn on the reminder schedule

1. Open `supabase/cron.sql`.
2. Replace `YOUR-APP-URL` with your Vercel address and `YOUR_CRON_SECRET` with your `CRON_SECRET`.
3. Paste it into the Supabase SQL Editor and click **Run**.

Every 5 minutes, Supabase asks the app to send any reminders that are due. Each message is logged, so nobody gets the same reminder twice.

### 5. First login

1. Open your site, choose **Create account**, and enter your name and phone number.
2. Choose **Set up a new firm** to become the Admin.
3. Go to **Team** and share the join code with colleagues.
4. Make sure everyone adds their phone number on **My account**. Reminders go there.

---

## Running it on your computer (developers)

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Project map

| Path | What it is |
| --- | --- |
| `supabase/schema.sql` | Tables, security rules, past-event lock, record-outcome logic |
| `supabase/cron.sql` | Reminder schedule (every 5 minutes) |
| `app/(app)/today` | Dashboard |
| `app/(app)/calendar` | Month view with hover previews |
| `app/(app)/matters` | Case files |
| `app/(app)/events` | New/edit event, event detail, record outcome |
| `app/(app)/team`, `account` | Staff, roles, join code, profile |
| `app/api/cron/reminders` | Sends due reminders through Termii |
| `lib/termii.ts`, `lib/messages.ts` | Message sending and wording |

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY`, `TERMII_API_KEY` and `CRON_SECRET` are secrets. Keep them only in Vercel's environment variables. Never put them in code, chat or email.
- Row-level security in the database makes sure every query only ever sees the signed-in user's own firm. People waiting for approval see nothing. Matters and events can only point to people and matters in the same firm.
- Signing out on a device removes its saved offline pages and switches off its notifications.
- Client data is stored with Supabase and Vercel, which are outside Nigeria. Before you onboard paying firms, have a lawyer confirm your setup and privacy policy meet the Nigeria Data Protection Act 2023.

---

## Updating an existing install to version 3 (approvals, archive, activity log, notifications)

Do these in one sitting, in this order:

1. **Supabase:** open **SQL Editor > New query**, paste `supabase/003_security_archive_reminders.sql` and click **Run**. It is safe on a live database. Existing staff stay approved, and reminders already sent are not sent again.
2. **Vercel:** add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (see the table above).
3. **GitHub:** merge the update. Vercel redeploys.

Between step 1 and step 3, anyone who uses the join code can't get in (the page keeps reloading) until the new version is live. Existing users are not affected.

## Updating an existing install to version 2 (messages)

1. In Supabase, open **SQL Editor > New query**, paste `supabase/002_messages_and_reminders.sql` and click **Run**.
2. In Vercel, open the project and go to **Settings > Environment Variables**. Change `NEXT_PUBLIC_APP_NAME` to `C-Diary`.
3. Upload the changed files to GitHub. Vercel redeploys automatically. Changing an environment variable alone needs a redeploy: **Deployments > ⋯ > Redeploy**.
