function normalizeNumber(text: string): number | null {
  const cleaned = text.replace(/[R$\s%]/gi, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseAmount(text: string): number | null {
  const value = normalizeNumber(text);
  if (value === null || value < 0) return null;
  return value;
}

export function parsePercentage(text: string): number | null {
  const value = normalizeNumber(text);
  if (value === null || value < 0 || value > 100) return null;
  return value;
}
