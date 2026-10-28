export type Role = 'admin' | 'partner' | 'associate' | 'clerk';
export type EventType = 'hearing' | 'filing' | 'client' | 'internal';
export type Outcome = 'adjourned' | 'reserved' | 'judgment' | 'struck_out' | 'settled' | 'held' | 'other';

export interface Firm {
  id: string;
  name: string;
  join_code: string;
}

export interface Profile {
  id: string;
  firm_id: string | null;
  full_name: string;
  phone: string | null;
  role: Role;
}

export interface Matter {
  id: string;
  firm_id: string;
  title: string;
  suit_number: string | null;
  court: string | null;
  courtroom: string | null;
  judge: string | null;
  client_name: string | null;
  client_phone: string | null;
  opposing_counsel: string | null;
  lead_lawyer_id: string | null;
  status: 'active' | 'closed';
  description: string | null;
  created_at: string;
}

export interface DiaryEvent {
  id: string;
  firm_id: string;
  matter_id: string | null;
  type: EventType;
  title: string;
  starts_at: string;
  purpose: string | null;
  court: string | null;
  courtroom: string | null;
  lawyer_id: string | null;
  notes: string | null;
  remind_day: boolean;
  remind_hour: boolean;
  remind_client: boolean;
  outcome: Outcome | null;
  outcome_note: string | null;
  outcome_recorded_at: string | null;
  next_event_id: string | null;
  created_at: string;
  matter?: Pick<Matter, 'id' | 'title' | 'suit_number' | 'client_name' | 'client_phone'> | null;
}

export interface ActionResult {
  error?: string;
  id?: string;
}
