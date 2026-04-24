export function defaultZipEntrySelector(entryPath: string): boolean {
  return entryPath.toLowerCase().endsWith('.txt');
}

