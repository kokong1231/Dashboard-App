import { SHORTCUT_INDEX, ShortcutIndexEntry } from '@/constants/shortcuts';

export function searchShortcuts(programId: string, query: string): ShortcutIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return SHORTCUT_INDEX.filter(
    entry =>
      entry.programId === programId &&
      (entry.keys.toLowerCase().includes(q) || entry.desc.toLowerCase().includes(q)),
  );
}
