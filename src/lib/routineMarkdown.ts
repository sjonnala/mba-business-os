import type { RoutineEntry } from './storage';

export function routineToMarkdown(
  entries: readonly RoutineEntry[],
  titleFor: (conceptId: string) => string,
): string {
  const lines: string[] = ['# MBA Business OS — 5-minute routine log', ''];
  if (entries.length === 0) {
    lines.push('_No entries yet._', '');
    return lines.join('\n');
  }
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const e of sorted) {
    lines.push(`## ${e.createdAt.slice(0, 10)} — ${titleFor(e.conceptId)}`, '');
    lines.push(`- **Explain it simply:** ${e.explain.trim() || '—'}`);
    lines.push(`- **Real example:** ${e.example.trim() || '—'}`);
    lines.push(`- **Thread pulled:** ${e.thread.trim() || '—'}`);
    lines.push(`- **Boardroom question:** ${e.question.trim() || '—'}`);
    lines.push('');
  }
  return lines.join('\n');
}
