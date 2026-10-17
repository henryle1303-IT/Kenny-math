import { prisma } from '../db';
import { DEFAULT_CONFIG, type LearningConfig } from '../learning/mastery';

export const STUDENT_ID = 'kenny';

export async function getStudent() {
  const { currentStudent } = await import('./student-auth');
  const s = await currentStudent();
  if (!s) { const { redirect } = await import('next/navigation'); redirect('/login'); }
  return s!;
}

export async function getSetting(key: string, db: Pick<typeof prisma, 'setting'> = prisma): Promise<string | null> {
  return (await db.setting.findUnique({ where: { key } }))?.value ?? null;
}
export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function getLearningConfig(db: Pick<typeof prisma, 'setting' | 'student'> = prisma, studentId?: string): Promise<LearningConfig> {
  const personal = studentId ? await db.student.findUnique({ where: { id: studentId }, select: { learningConfig: true } }) : null;
  const raw = personal?.learningConfig ?? await getSetting('learningConfig', db);
  if (!raw) return DEFAULT_CONFIG;
  try {
    const p = JSON.parse(raw) as Partial<LearningConfig>;
    return { ...DEFAULT_CONFIG, ...p, intervals: { ...DEFAULT_CONFIG.intervals, ...(p.intervals ?? {}) } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function getLang(): Promise<'en' | 'vi'> {
  const s = await getStudent();
  try {
    return (JSON.parse(s.preferences).lang === 'vi' ? 'vi' : 'en') as 'en' | 'vi';
  } catch {
    return 'en';
  }
}
