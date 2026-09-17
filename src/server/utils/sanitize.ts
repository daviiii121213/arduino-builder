/** Normaliza e limita textos vindos do cliente, removendo caracteres de controle. */
export function cleanText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const isControl = code < 32 && char !== '\n' && char !== '\t';
    if (isControl || code === 127) continue;
    out += char;
  }
  return out.trim().slice(0, maxLength);
}

export function cleanOptional(value: unknown, maxLength = 500): string | null {
  const text = cleanText(value, maxLength);
  return text.length ? text : null;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(value);
}

export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}
