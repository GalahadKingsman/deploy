import type { ContractsV1 } from '@tracked/shared';

export function truncateMiddle(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export function pluralLessons(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} урок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} урока`;
  return `${n} уроков`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function lessonFormatTag(lesson: ContractsV1.ExpertLessonV1): string {
  const v = lesson.video;
  if (v && v.kind !== 'none') return 'VIDEO';
  if (lesson.presentation?.pdfKey) return 'PDF';
  const md = (lesson.contentMarkdown ?? '').trim();
  if (md.length > 0) return 'MD';
  return 'TEXT';
}

export function formatLessonMeta(lesson: ContractsV1.ExpertLessonV1): string[] {
  const parts: string[] = [];
  parts.push(lessonFormatTag(lesson));
  if (lesson.hiddenFromStudents) parts.push('Скрыт');

  const v = lesson.video;
  if (v && v.kind === 'rutube') {
    parts.push('Rutube');
  } else if (v && v.kind === 'youtube') {
    parts.push('YouTube');
  } else if (v && v.kind === 'upload') {
    parts.push('Файл');
  } else {
    const words = countWords(lesson.contentMarkdown ?? '');
    if (words > 0) {
      parts.push(`${words} сл.`);
      parts.push(`~${Math.max(1, Math.round(words / 150))} мин`);
    }
  }

  return parts;
}
