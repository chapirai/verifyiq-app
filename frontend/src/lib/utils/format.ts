export function formatOrgnr(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export function formatDate(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function statusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('high') || normalized.includes('reject') || normalized.includes('alert')) {
    return 'text-red-400';
  }
  if (normalized.includes('medium') || normalized.includes('pending') || normalized.includes('review')) {
    return 'text-amber-400';
  }
  if (normalized.includes('active') || normalized.includes('approved') || normalized.includes('ok')) {
    return 'text-emerald-400';
  }
  return 'text-slate-300';
}
