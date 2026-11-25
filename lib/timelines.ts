/**
 * Filing timelines from "Timelines and processes: from Magistrates Court to Supreme Court",
 * prepared by Ogheneruno Isiavwe. `rule` keeps the document's own wording; `calc` is how
 * C-Diary turns it into a date. Rules with no fixed period have no `calc` and are shown for reference.
 */

export type Unit = 'days' | 'months' | 'working_days';
/** after: n after the trigger. before: not later than n before the trigger. clear: n clear days before the trigger. */
export type Direction = 'after' | 'before' | 'clear';

export interface Calc {
  n: number;
  unit: Unit;
  dir: Direction;
  /** What date the user enters, phrased as a label. */
  from: string;
  /** The trigger day itself counts as day 1 (the document says "including the date"). */
  inclusive?: boolean;
}

export interface Timeline {
  id: string;
  process: string;
  rule: string;
  calc?: Calc;
  note?: string;
}

export interface Court {
  id: string;
  name: string;
  short: string;
  /** Election matters: dates are never moved off weekends or holidays. */
  strict?: boolean;
  timelines: Timeline[];
}

const d = (n: number, from: string, extra: Partial<Calc> = {}): Calc => ({ n, unit: 'days', dir: 'after', from, ...extra });

export const COURTS: Court[] = [
  {
    id: 'mag',
    name: 'Magistrates Court',
    short: 'Magistrates',
    timelines: [
      { id: 'mag-1', process: 'Claim via ordinary summons', rule: 'Within 3 months of issuance', calc: { n: 3, unit: 'months', dir: 'after', from: 'Date the summons was issued' } },
      { id: 'mag-2', process: 'Defendant’s notice for further particulars', rule: 'Within 6 days of receipt of ordinary summons', calc: d(6, 'Date the ordinary summons was received') },
      { id: 'mag-3', process: 'Claimant’s further particulars', rule: 'Within 2 days of service of Defendant’s notice for further particulars', calc: d(2, 'Date the notice for further particulars was served') },
      { id: 'mag-4', process: 'Counterclaim, set-off or defence to a claim', rule: 'Within 6 days of service of ordinary summons', calc: d(6, 'Date the ordinary summons was served') },
      { id: 'mag-5', process: 'Defendant’s admission to claim', rule: '6 days of service of summons', calc: d(6, 'Date the summons was served') },
      { id: 'mag-6', process: 'Claimant’s notice of acceptance', rule: '3 days of receipt of admission', calc: d(3, 'Date the admission was received') },
      { id: 'mag-7', process: 'Claimant’s notice of non-acceptance', rule: '3 days of receipt of Defendant’s admission', calc: d(3, 'Date the admission was received') },
      { id: 'mag-8', process: 'Defence, admission or counterclaim to summary summons', rule: '5 days of service of summary summons', calc: d(5, 'Date the summary summons was served') },
      { id: 'mag-9', process: 'Claimant’s notice of acceptance (summary summons)', rule: '5 days of receipt of Defendant’s notice of admission', calc: d(5, 'Date the notice of admission was received') },
      { id: 'mag-10', process: 'Claimant’s notice of non-acceptance (summary summons)', rule: '5 days of receipt of Defendant’s notice of admission', calc: d(5, 'Date the notice of admission was received') },
      { id: 'mag-11', process: 'Notice to defend in a representative capacity', rule: '5 days of receipt of summons', calc: d(5, 'Date the summons was received') },
      { id: 'mag-12', process: 'Proof of service', rule: '2 days of service (including the date the service was effected)', calc: d(2, 'Date service was effected', { inclusive: true }) },
      { id: 'mag-13', process: 'Notice of application for third party proceedings', rule: '2 days of service of summons (inclusive of the date service was effected)', calc: d(2, 'Date the summons was served', { inclusive: true }) },
      { id: 'mag-14', process: 'Response to interlocutory application', rule: 'Within 2 days of service', calc: d(2, 'Date the application was served') },
      { id: 'mag-15', process: 'Defendant’s application for execution warrant for unpaid costs', rule: 'Filed where costs remain unpaid after 5 days of Claimant filing notice of discontinuance', calc: d(5, 'Date the notice of discontinuance was filed'), note: 'This is the earliest date you can apply, not a last date.' },
      { id: 'mag-16', process: 'Claimant’s request for a trial date', rule: 'Within 10 days of filing claim', calc: d(10, 'Date the claim was filed') },
    ],
  },
  {
    id: 'lagos-hc',
    name: 'High Court of Lagos State',
    short: 'Lagos High Court',
    timelines: [
      { id: 'lhc-1', process: 'Claimant’s originating processes', rule: 'No prescribed time but should be filed at the commencement of the suit.' },
      { id: 'lhc-2', process: 'Defendant’s memorandum of appearance', rule: 'Within 42 days of receipt/service of claimant’s originating processes', calc: d(42, 'Date the originating processes were served') },
      { id: 'lhc-3', process: 'Service of sealed memorandum of appearance on the claimant', rule: 'Within 7 days of entering appearance.', calc: d(7, 'Date appearance was entered') },
      { id: 'lhc-4', process: 'Statement of defence, set-off or counterclaim', rule: 'Within 42 days of receiving claimant’s originating process.', calc: d(42, 'Date the originating processes were received') },
      { id: 'lhc-5', process: 'Claimant’s reply to statement of defence and counterclaim', rule: 'Within 14 days of receipt/service of the Statement of Defence and Counter Claim.', calc: d(14, 'Date the statement of defence was served') },
      { id: 'lhc-6', process: 'Claimant’s application for CMC notice', rule: 'Within 14 days of close of pleadings.', calc: d(14, 'Date pleadings closed') },
      { id: 'lhc-7', process: 'Interrogatories', rule: 'Within 7 days of close of pleadings.', calc: d(7, 'Date pleadings closed') },
      { id: 'lhc-8', process: 'Request for discovery of documents', rule: 'Within 7 days after close of pleadings.', calc: d(7, 'Date pleadings closed') },
      { id: 'lhc-9', process: 'Answer or affidavit in response to request for discovery', rule: 'Within 7 days of receipt of the request, unless the Judge otherwise allows.', calc: d(7, 'Date the request was received') },
      { id: 'lhc-10', process: 'Issues of fact', rule: 'Within 14 days after close of pleadings.', calc: d(14, 'Date pleadings closed') },
      { id: 'lhc-11', process: 'Notice to admit documents', rule: 'Not later than 7 days before the first CMC.', calc: { n: 7, unit: 'days', dir: 'before', from: 'Date of the first CMC' } },
      { id: 'lhc-12', process: 'Response to notice to admit documents', rule: 'Within 4 days after service.', calc: d(4, 'Date the notice was served') },
      { id: 'lhc-13', process: 'Notice challenging authenticity of a document', rule: 'Not later than 7 days after service of the document.', calc: d(7, 'Date the document was served') },
      { id: 'lhc-14', process: 'Notice to admit facts', rule: 'File and serve not later than 7 days before the first CMC.', calc: { n: 7, unit: 'days', dir: 'before', from: 'Date of the first CMC' } },
      { id: 'lhc-15', process: 'Response admitting or not admitting facts', rule: 'Within 4 days of service of notice to admit facts.', calc: d(4, 'Date the notice to admit facts was served') },
      { id: 'lhc-16', process: 'Amended writ, pleading or other process after leave', rule: 'Within the time specified by the Court and where no time is specified, within 7 days from the date of the order.', calc: d(7, 'Date of the order granting leave'), note: 'Use this only where the order did not set its own time.' },
      { id: 'lhc-17', process: 'Final written address (where Defendant calls evidence)', rule: 'Within 21 days after conclusion/close of evidence.', calc: d(21, 'Date evidence closed') },
      { id: 'lhc-18', process: 'Claimant’s final written address after Defendant’s address', rule: 'Within 21 days after service of the Defendant’s Final Written Address.', calc: d(21, 'Date the Defendant’s final written address was served') },
      { id: 'lhc-19', process: 'Claimant’s final written address where Defendant calls no evidence', rule: 'Within 21 days after close of evidence.', calc: d(21, 'Date evidence closed') },
      { id: 'lhc-20', process: 'Final written address of party who called no evidence', rule: 'Within 21 days after service of the first Final Written Address.', calc: d(21, 'Date the first final written address was served') },
      { id: 'lhc-21', process: 'Reply on points of law', rule: 'Within 7 days after service of the opposing Final Written Address.', calc: d(7, 'Date the opposing final written address was served') },
      { id: 'lhc-22', process: 'Application to set aside order for failure to participate in CMC', rule: 'Within 7 days of the relevant decision/order.', calc: d(7, 'Date of the decision or order') },
      { id: 'lhc-23', process: 'Application to relist a struck-out suit or set aside judgment', rule: 'Within 7 days of the order/ judgment being given.', calc: d(7, 'Date of the order or judgment') },
    ],
  },
  {
    id: 'nicn',
    name: 'National Industrial Court of Nigeria',
    short: 'Industrial Court',
    timelines: [
      { id: 'nicn-1', process: 'Complaint with statement of facts and accompanying processes', rule: 'At commencement of the action. It is to be filed with the prescribed accompanying processes.' },
      { id: 'nicn-2', process: 'Defendant’s memorandum of appearance', rule: 'Within 14 days of service of the originating process.', calc: d(14, 'Date the originating process was served') },
      { id: 'nicn-3', process: 'Advance copy of memorandum of appearance or other process', rule: 'Forward to the other party within 7 days of filing the process.', calc: d(7, 'Date the process was filed') },
      { id: 'nicn-4', process: 'Statement of defence (with set-off and counterclaim)', rule: 'To be filed not later than 14 days after service of the Claimant’s originating processes.', calc: d(14, 'Date the originating processes were served') },
      { id: 'nicn-5', process: 'Reply to statement of defence or defence to counterclaim', rule: 'Within 14 days of service of the Statement of Defence and Counterclaim.', calc: d(14, 'Date the statement of defence was served') },
      { id: 'nicn-6', process: 'Notice to admit documents', rule: 'Not later than 7 days after close of pleadings.', calc: d(7, 'Date pleadings closed') },
      { id: 'nicn-7', process: 'Notice of admission or non-admission of documents', rule: 'Not later than 4 days after service of the Notice to Admit Documents.', calc: d(4, 'Date the notice to admit documents was served') },
      { id: 'nicn-8', process: 'Notice challenging authenticity of a document', rule: 'Not later than 7 days after service of the document.', calc: d(7, 'Date the document was served') },
      { id: 'nicn-9', process: 'Notice to admit facts', rule: 'Not later than 7 days before close of pleadings.', calc: { n: 7, unit: 'days', dir: 'before', from: 'Date pleadings will close' } },
      { id: 'nicn-10', process: 'Response admitting or denying facts', rule: 'Not later than 4 days after service of the notice, unless further time is allowed by the Court.', calc: d(4, 'Date the notice to admit facts was served') },
      { id: 'nicn-11', process: 'Request for discovery or inspection', rule: 'Within 7 days of the parties joining issues.', calc: d(7, 'Date the parties joined issues') },
      { id: 'nicn-12', process: 'Affidavit or answer to request for discovery', rule: 'Within 7 days of the request, or within such other time as the Judge may allow.', calc: d(7, 'Date of the request') },
      { id: 'nicn-13', process: 'Counter-affidavit opposing motion for discovery', rule: 'Within 7 days of service of the Motion on Notice.', calc: d(7, 'Date the motion was served') },
      { id: 'nicn-14', process: 'Final written address where the party who did not begin calls evidence', rule: 'Within 21 days after close of evidence.', calc: d(21, 'Date evidence closed') },
      { id: 'nicn-15', process: 'Final written address of the party beginning, after the other’s address', rule: 'Within 21 days after service of the other party’s Final Written Address.', calc: d(21, 'Date the other party’s address was served') },
      { id: 'nicn-16', process: 'Final written address where the other party calls no evidence', rule: 'Within 21 days after close of evidence; the other party then has 21 days after service to file its address.', calc: d(21, 'Date evidence closed') },
      { id: 'nicn-17', process: 'Reply on points of law', rule: 'Within 7 days after service of the other party’s address.', calc: d(7, 'Date the other party’s address was served') },
      { id: 'nicn-18', process: 'Motion for release of exhibits for an appeal', rule: 'Within 30 working days from delivery of judgment.', calc: { n: 30, unit: 'working_days', dir: 'after', from: 'Date judgment was delivered' } },
    ],
  },
  {
    id: 'coa',
    name: 'Court of Appeal',
    short: 'Court of Appeal',
    timelines: [
      { id: 'coa-1', process: 'Notice of appeal or leave to appeal: civil interlocutory decision', rule: 'Within 14 days from the date of the interlocutory decision.', calc: d(14, 'Date of the interlocutory decision') },
      { id: 'coa-2', process: 'Notice of appeal or leave to appeal: civil final decision', rule: 'Within 3 months from the date of the final decision.', calc: { n: 3, unit: 'months', dir: 'after', from: 'Date of the final decision' } },
      { id: 'coa-3', process: 'Notice of appeal or leave to appeal: criminal matter', rule: 'Within 90 days from the date of the decision appealed against.', calc: d(90, 'Date of the decision') },
      { id: 'coa-4', process: 'Notice of address for service', rule: 'Within 14 days after service of the Notice of Appeal.', calc: d(14, 'Date the notice of appeal was served') },
      { id: 'coa-5', process: 'Compilation and transmission of record of appeal (Registrar)', rule: 'Within 60 days after filing of the Notice of Appeal.', calc: d(60, 'Date the notice of appeal was filed') },
      { id: 'coa-6', process: 'Appellant’s compilation of record where Registrar defaults', rule: 'After expiry of the Registrar’s 60-day period, the Appellant must compile and transmit the Record within the next 30 days.', calc: d(90, 'Date the notice of appeal was filed'), note: 'Counted as the Registrar’s 60 days plus the Appellant’s 30 days.' },
      { id: 'coa-7', process: 'Service of Appellant-compiled record on Respondent', rule: 'Within the same 30-day period prescribed for the Appellant’s compilation/transmission of the Record.', calc: d(90, 'Date the notice of appeal was filed'), note: 'Same last day as the Appellant’s compilation.' },
      { id: 'coa-8', process: 'Additional record of appeal', rule: 'Within 15 days after service of the Record of Appeal, where additional documents are required.', calc: d(15, 'Date the record of appeal was served') },
      { id: 'coa-9', process: 'Respondent’s notice to vary or affirm: interlocutory appeal', rule: 'Within 15 days after service of the Notice of Appeal.', calc: d(15, 'Date the notice of appeal was served') },
      { id: 'coa-10', process: 'Respondent’s notice to vary or affirm: other appeals', rule: 'Within 30 days after service of the Notice of Appeal.', calc: d(30, 'Date the notice of appeal was served') },
      { id: 'coa-11', process: 'Preliminary objection to hearing of appeal', rule: 'Give the Appellant 3 clear days’ notice before the hearing and file the notice within the same period.', calc: { n: 3, unit: 'days', dir: 'clear', from: 'Date of the hearing' } },
      { id: 'coa-12', process: 'Appellant’s brief of argument', rule: 'Within 45 days of receipt of the Record of Appeal from the lower court.', calc: d(45, 'Date the record of appeal was received') },
      { id: 'coa-13', process: 'Respondent’s brief of argument', rule: 'Within 30 days after service of the Appellant’s Brief.', calc: d(30, 'Date the Appellant’s brief was served') },
      { id: 'coa-14', process: 'Appellant’s reply brief', rule: 'Within 14 days after service of the Respondent’s Brief, where necessary.', calc: d(14, 'Date the Respondent’s brief was served') },
    ],
  },
  {
    id: 'sc',
    name: 'Supreme Court of Nigeria',
    short: 'Supreme Court',
    timelines: [
      { id: 'sc-1', process: 'Notice of appeal or leave to appeal: civil interlocutory decision', rule: 'Within 14 days from the date of the interlocutory decision.', calc: d(14, 'Date of the interlocutory decision') },
      { id: 'sc-2', process: 'Notice of appeal or leave to appeal: civil final decision', rule: 'Within 3 months from the date of the final decision.', calc: { n: 3, unit: 'months', dir: 'after', from: 'Date of the final decision' } },
      { id: 'sc-3', process: 'Notice of appeal or leave to appeal: criminal matter', rule: 'Within 30 days from the date of the decision appealed against.', calc: d(30, 'Date of the decision') },
      { id: 'sc-4', process: 'Respondent’s notice of address for service', rule: 'Within 14 days after service of the Notice of Appeal.', calc: d(14, 'Date the notice of appeal was served') },
      { id: 'sc-5', process: 'Counter-affidavit and written address opposing a motion', rule: 'Within 14 days; a counter-affidavit/written address is also due not later than 14 days after service of the application.', calc: d(14, 'Date the application was served') },
      { id: 'sc-6', process: 'Reply written address on an application', rule: 'Within 7 days.', calc: d(7, 'Date the Respondent’s processes were served') },
      { id: 'sc-7', process: 'Notice of non-contention to an application', rule: 'Within 14 days of service of the application where the Respondent does not intend to contest it.', calc: d(14, 'Date the application was served') },
      { id: 'sc-8', process: 'Preliminary objection to an appeal', rule: 'Not less than 5 clear days before hearing; the notice must be filed within the same period.', calc: { n: 5, unit: 'days', dir: 'clear', from: 'Date of the hearing' } },
      { id: 'sc-9', process: 'Payment of record-preparation costs or security for costs', rule: 'Within not more than 14 days after assessment by the Registrar of the Court below.', calc: d(14, 'Date the Registrar assessed the costs') },
      { id: 'sc-10', process: 'Evidence of payment of costs into escrow', rule: '21 days after filing the Notice of Appeal, or before transmission of the Record of Appeal, whichever is earlier.', calc: d(21, 'Date the notice of appeal was filed'), note: 'If the record will be transmitted before this date, the earlier date applies.' },
      { id: 'sc-11', process: 'Compilation and transmission of record (general final appeals)', rule: 'Within not more than 3 months from filing of the Notice of Appeal.', calc: { n: 3, unit: 'months', dir: 'after', from: 'Date the notice of appeal was filed' } },
      { id: 'sc-12', process: 'Appellant’s direct compilation of record (2026 Practice Direction)', rule: 'May compile before the Registrar’s prescribed period expires; in any event, not later than 30 days after the Registrar’s prescribed period has elapsed.', calc: d(30, 'Date the Registrar’s period ended') },
      { id: 'sc-13', process: 'Further documents where Appellant compiles the record', rule: 'Within 7 days after service of the Record filed by the Appellant.', calc: d(7, 'Date the record was served') },
      { id: 'sc-14', process: 'Appellant’s brief of argument', rule: 'Within 45 days after service of the Record of Appeal.', calc: d(45, 'Date the record of appeal was served') },
      { id: 'sc-15', process: 'Respondent’s brief of argument', rule: 'Within 30 days after service of the Appellant’s Brief.', calc: d(30, 'Date the Appellant’s brief was served') },
      { id: 'sc-16', process: 'Appellant’s reply brief', rule: 'Within 14 days after service of the Respondent’s Brief, where necessary.', calc: d(14, 'Date the Respondent’s brief was served') },
    ],
  },
  {
    id: 'ept',
    name: 'Election Petition Tribunal',
    short: 'Election Tribunal',
    strict: true,
    timelines: [
      { id: 'ept-1', process: 'Election petition with witnesses, statements and documents', rule: 'To be filed within 21 days of declaration of results.', calc: d(21, 'Date the results were declared'), note: 'This period is fixed by the Constitution and cannot be extended.' },
      { id: 'ept-2', process: 'Security for costs', rule: 'To be deposited with the tribunal or court at the time of presenting the petition' },
      { id: 'ept-3', process: 'Memorandum of appearance', rule: 'Within five to seven days after the date of service of the notice', calc: d(5, 'Date the petition was served'), note: 'The document gives five to seven days; this uses the shorter period to be safe.' },
      { id: 'ept-4', process: 'Respondent’s reply to the petition', rule: 'Within 21 days of service of the petition', calc: d(21, 'Date the petition was served'), },
      { id: 'ept-5', process: 'Petitioner’s reply to new issues in Respondent’s reply', rule: 'within five days from the receipt of the Respondent’s reply', calc: d(5, 'Date the Respondent’s reply was received') },
      { id: 'ept-6', process: 'Motion for further particulars or other directions', rule: 'after entry of appearance, but not later than 10 days after the filing of the reply.', calc: d(10, 'Date the reply was filed') },
      { id: 'ept-7', process: 'Application for pre-hearing notice (Form TF 007)', rule: 'Within seven days after the filing and service of the petitioner’s reply on the respondent or seven days after the filing and service of the respondent’s reply.', calc: d(7, 'Date the last reply was filed and served') },
      { id: 'ept-8', process: 'Respondent’s notice of no opposition', rule: 'Not less than six days before the day appointed for the hearing of the election petition', calc: { n: 6, unit: 'days', dir: 'before', from: 'Date fixed for hearing' } },
      { id: 'ept-9', process: 'Application to set aside judgment for failure to attend pre-hearing', rule: 'Within seven days of the judgment', calc: d(7, 'Date of the judgment') },
      { id: 'ept-10', process: 'Written address or counter-affidavit opposing a motion', rule: 'Within 7 days after service of the application.', calc: d(7, 'Date the application was served') },
      { id: 'ept-11', process: 'Reply on points of law to response to a motion', rule: 'Within 3 days after service of the Respondent’s written address.', calc: d(3, 'Date the written address was served') },
      { id: 'ept-12', process: 'Final written address where the other party calls no evidence', rule: 'Within 10 days after close of evidence; the other party then has 7 days after service to file its address.', calc: d(10, 'Date evidence closed') },
      { id: 'ept-13', process: 'Final written address where the other party calls evidence', rule: 'Within 10 days after close of its evidence.', calc: d(10, 'Date evidence closed') },
      { id: 'ept-14', process: 'Final written address of the party beginning, after the other’s address', rule: 'Within 7 days after service of the other party’s Written Address.', calc: d(7, 'Date the other party’s address was served') },
      { id: 'ept-15', process: 'Reply on points of law to final written address', rule: 'Within 5 days after service of the other party’s Written Address.', calc: d(5, 'Date the other party’s address was served') },
    ],
  },
];

export const SOURCE = 'Timelines and processes: from Magistrates Court to Supreme Court';

export function findTimeline(id: string | null | undefined): { court: Court; t: Timeline } | null {
  if (!id) return null;
  for (const court of COURTS) {
    const t = court.timelines.find((x) => x.id === id);
    if (t) return { court, t };
  }
  return null;
}
