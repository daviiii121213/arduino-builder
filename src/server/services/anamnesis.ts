import { db } from '../db';
import { badRequest } from '../utils/http';
import { cleanOptional } from '../utils/sanitize';
import { getPatient } from './patients';

export interface Question {
  id: string;
  text: string;
  /** Uma resposta "sim" vira alerta clínico na ficha do paciente. */
  risk: boolean;
  detail?: string;
}

export const QUESTIONS: Question[] = [
  { id: 'saude_geral', text: 'Está em tratamento médico no momento?', risk: false, detail: 'Qual tratamento?' },
  { id: 'alergia', text: 'Tem alergia a algum medicamento ou anestésico?', risk: true, detail: 'A quê?' },
  { id: 'medicacao', text: 'Usa medicação contínua?', risk: false, detail: 'Quais medicamentos?' },
  { id: 'anticoagulante', text: 'Usa anticoagulante (ex.: varfarina, AAS)?', risk: true },
  { id: 'diabetes', text: 'Tem diabetes?', risk: true },
  { id: 'pressao', text: 'Tem pressão alta ou problema cardíaco?', risk: true },
  { id: 'gestante', text: 'Está grávida ou amamentando?', risk: true, detail: 'Semanas de gestação' },
  { id: 'hemorragia', text: 'Já teve sangramento excessivo após extração ou cirurgia?', risk: true },
  { id: 'fumante', text: 'Fuma?', risk: false },
  { id: 'bruxismo', text: 'Range ou aperta os dentes (bruxismo)?', risk: false },
  { id: 'anestesia', text: 'Já teve reação ruim à anestesia odontológica?', risk: true, detail: 'O que aconteceu?' },
  { id: 'cirurgia', text: 'Fez alguma cirurgia nos últimos 12 meses?', risk: false, detail: 'Qual?' }
];

const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export interface Answer {
  value: 'sim' | 'nao';
  detail: string;
}

export interface RiskFlag {
  id: string;
  label: string;
  detail: string;
}

export interface Anamnesis {
  patientId: number;
  answers: Record<string, Answer>;
  filledBy: string;
  riskFlags: RiskFlag[];
  complete: boolean;
  updatedAt: string | null;
}

interface AnamnesisRow {
  patient_id: number;
  answers: string;
  filled_by: string;
  updated_at: string;
}

function parseAnswers(raw: string): Record<string, Answer> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Alertas derivados das respostas — calculados aqui, nunca enviados pelo cliente. */
export function riskFlagsOf(answers: Record<string, Answer>): RiskFlag[] {
  return QUESTIONS
    .filter((q) => q.risk && answers[q.id]?.value === 'sim')
    .map((q) => ({
      id: q.id,
      label: q.text.replace(/\?$/, ''),
      detail: answers[q.id]?.detail ?? ''
    }));
}

export function getAnamnesis(patientId: number): Anamnesis {
  getPatient(patientId);
  const row = db.prepare('SELECT * FROM anamneses WHERE patient_id = ?')
    .get(patientId) as AnamnesisRow | undefined;
  const answers = row ? parseAnswers(row.answers) : {};
  return {
    patientId,
    answers,
    filledBy: row ? row.filled_by : '',
    riskFlags: riskFlagsOf(answers),
    complete: QUESTIONS.every((q) => Boolean(answers[q.id]?.value)),
    updatedAt: row ? row.updated_at : null
  };
}

export function saveAnamnesis(
  patientId: number,
  payload: Record<string, unknown>,
  filledBy: 'clinica' | 'paciente'
): Anamnesis {
  getPatient(patientId);
  const raw = (payload.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, Answer> = {};
  const details: Record<string, string> = {};

  for (const [id, value] of Object.entries(raw)) {
    if (!QUESTION_BY_ID.has(id)) {
      details[id] = 'Pergunta desconhecida.';
      continue;
    }
    const answer = (value ?? {}) as Record<string, unknown>;
    const chosen = String(answer.value ?? '');
    if (chosen !== 'sim' && chosen !== 'nao') {
      details[id] = 'Responda com "sim" ou "nao".';
      continue;
    }
    answers[id] = { value: chosen, detail: cleanOptional(answer.detail, 300) ?? '' };
  }

  if (Object.keys(details).length) throw badRequest('Verifique as respostas da anamnese.', details);

  const missing = QUESTIONS.filter((q) => !answers[q.id]);
  if (missing.length) {
    throw badRequest('Responda todas as perguntas da anamnese.', {
      answers: `Faltam ${missing.length} resposta(s): ${missing.map((q) => q.id).join(', ')}.`
    });
  }

  db.prepare(`
    INSERT INTO anamneses (patient_id, answers, filled_by)
    VALUES (@patientId, @answers, @filledBy)
    ON CONFLICT(patient_id) DO UPDATE SET
      answers = @answers, filled_by = @filledBy, updated_at = datetime('now')
  `).run({ patientId, answers: JSON.stringify(answers), filledBy });

  return getAnamnesis(patientId);
}
