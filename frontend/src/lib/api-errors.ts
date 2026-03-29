export type ApiMessage = string | string[] | null | undefined;

export function formatApiMessage(message: ApiMessage): string | null {
  if (typeof message === 'string') {
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(message)) {
    const filtered = message
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
    return filtered.length > 0 ? filtered.join(' • ') : null;
  }

  return null;
}
