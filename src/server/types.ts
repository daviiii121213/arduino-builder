export type Sex = 'feminino' | 'masculino' | 'outro';

export type AppointmentStatus =
  | 'aguardando'
  | 'confirmada'
  | 'em_atendimento'
  | 'atendida'
  | 'cancelada';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'aguardando',
  'confirmada',
  'em_atendimento',
  'atendida',
  'cancelada'
];

export const SEXES: Sex[] = ['feminino', 'masculino', 'outro'];

export interface PatientRow {
  id: number;
  name: string;
  birth_date: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow {
  id: number;
  patient_id: number;
  service_id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price: number;
  reason: string;
  notes: string | null;
  status: AppointmentStatus;
  origin: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsRow {
  id: number;
  clinic_name: string;
  phone: string;
  email: string;
  address: string;
  opening_time: string;
  closing_time: string;
  closed_weekdays: string;
  slot_interval: number;
  dentist_name: string;
  dentist_title: string;
  dentist_cro: string;
  updated_at: string;
}

export interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  appointment_id: number | null;
  patient_id: number | null;
  read: number;
  created_at: string;
}

export interface ServiceRow {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
  active: number;
  created_at: string;
  updated_at: string;
}
