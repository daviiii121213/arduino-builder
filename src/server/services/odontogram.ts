import { db } from '../db';
import { badRequest } from '../utils/http';
import { cleanOptional } from '../utils/sanitize';
import { getPatient } from './patients';

/** Condições possíveis de um dente inteiro. */
export const TOOTH_STATUS: Record<string, string> = {
  higido: 'Hígido',
  cariado: 'Cárie',
  restaurado: 'Restaurado',
  canal: 'Canal tratado',
  coroa: 'Coroa/prótese',
  implante: 'Implante',
  ausente: 'Ausente',
  extrair: 'Extração indicada'
};

/** Condições possíveis de cada face. */
export const FACE_STATUS: Record<string, string> = {
  livre: 'Sem alteração',
  cariado: 'Cárie',
  restaurado: 'Restaurada'
};

export const FACES: Record<string, string> = {
  O: 'Oclusal/Incisal',
  M: 'Mesial',
  D: 'Distal',
  V: 'Vestibular',
  L: 'Lingual/Palatina'
};

/** Numeração FDI: permanentes (11-48) e decíduos (51-85). */
export const PERMANENT_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
];
export const DECIDUOUS_TEETH = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
  85, 84, 83, 82, 81, 71, 72, 73, 74, 75
];
export const VALID_TEETH = new Set([...PERMANENT_TEETH, ...DECIDUOUS_TEETH]);

export interface ToothState {
  status: string;
  faces: Record<string, string>;
  note: string;
}

export interface Odontogram {
  patientId: number;
  teeth: Record<string, ToothState>;
  markedTeeth: number;
  updatedAt: string | null;
}

interface OdontogramRow {
  patient_id: number;
  teeth: string;
  updated_at: string;
}

function parseTeeth(raw: string): Record<string, ToothState> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const isMarked = (tooth: ToothState) =>
  tooth.status !== 'higido' || Object.values(tooth.faces || {}).some((f) => f && f !== 'livre');

export function getOdontogram(patientId: number): Odontogram {
  getPatient(patientId); // 404 quando o paciente não existe
  const row = db.prepare('SELECT * FROM odontograms WHERE patient_id = ?')
    .get(patientId) as OdontogramRow | undefined;
  const teeth = row ? parseTeeth(row.teeth) : {};
  return {
    patientId,
    teeth,
    markedTeeth: Object.values(teeth).filter(isMarked).length,
    updatedAt: row ? row.updated_at : null
  };
}

/** Valida e normaliza o registro de um dente (o cliente não define o formato). */
function validateTooth(code: number, payload: Record<string, unknown>): ToothState {
  if (!VALID_TEETH.has(code)) {
    throw badRequest('Dente inválido.', { tooth: 'Use a numeração FDI (11-48 ou 51-85).' });
  }
  const status = String(payload.status ?? 'higido');
  if (!TOOTH_STATUS[status]) {
    throw badRequest('Condição do dente inválida.', {
      status: `Use uma destas condições: ${Object.keys(TOOTH_STATUS).join(', ')}.`
    });
  }

  const faces: Record<string, string> = {};
  const rawFaces = (payload.faces ?? {}) as Record<string, unknown>;
  for (const [face, value] of Object.entries(rawFaces)) {
    if (!FACES[face]) {
      throw badRequest('Face inválida.', { faces: `Faces válidas: ${Object.keys(FACES).join(', ')}.` });
    }
    const faceStatus = String(value ?? 'livre');
    if (!FACE_STATUS[faceStatus]) {
      throw badRequest('Condição da face inválida.', {
        faces: `Condições válidas: ${Object.keys(FACE_STATUS).join(', ')}.`
      });
    }
    if (faceStatus !== 'livre') faces[face] = faceStatus;
  }

  return { status, faces, note: cleanOptional(payload.note, 500) ?? '' };
}

function saveTeeth(patientId: number, teeth: Record<string, ToothState>): Odontogram {
  db.prepare(`
    INSERT INTO odontograms (patient_id, teeth) VALUES (@patientId, @teeth)
    ON CONFLICT(patient_id) DO UPDATE SET teeth = @teeth, updated_at = datetime('now')
  `).run({ patientId, teeth: JSON.stringify(teeth) });
  return getOdontogram(patientId);
}

/** Atualiza um dente sem tocar nos demais. */
export function setTooth(patientId: number, code: number, payload: Record<string, unknown>): Odontogram {
  const current = getOdontogram(patientId);
  const teeth = { ...current.teeth };
  const tooth = validateTooth(code, payload);
  if (isMarked(tooth)) teeth[String(code)] = tooth;
  else delete teeth[String(code)]; // dente hígido sem faces não ocupa espaço
  return saveTeeth(patientId, teeth);
}

export function clearTooth(patientId: number, code: number): Odontogram {
  const current = getOdontogram(patientId);
  const teeth = { ...current.teeth };
  delete teeth[String(code)];
  return saveTeeth(patientId, teeth);
}

/** Substitui o odontograma inteiro (importação ou edição em lote). */
export function replaceOdontogram(patientId: number, payload: Record<string, unknown>): Odontogram {
  getPatient(patientId);
  const raw = (payload.teeth ?? {}) as Record<string, unknown>;
  const teeth: Record<string, ToothState> = {};
  for (const [code, value] of Object.entries(raw)) {
    const tooth = validateTooth(Number(code), (value ?? {}) as Record<string, unknown>);
    if (isMarked(tooth)) teeth[code] = tooth;
  }
  return saveTeeth(patientId, teeth);
}

export function odontogramReference() {
  return {
    toothStatus: TOOTH_STATUS,
    faceStatus: FACE_STATUS,
    faces: FACES,
    permanent: PERMANENT_TEETH,
    deciduous: DECIDUOUS_TEETH
  };
}
