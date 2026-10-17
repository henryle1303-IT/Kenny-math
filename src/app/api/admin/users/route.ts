import { adminHandle, readJson } from '@/lib/http';
import { createUser, publicProfile } from '@/lib/services/users';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  return adminHandle(req, 'read.users', async () => prisma.student.findMany({ select: publicProfile, orderBy: { createdAt: 'asc' } }));
}
export async function POST(req: Request) {
  let studentId: string | undefined;
  return adminHandle(req, 'user.create', async () => { const user = await createUser(await readJson(req)); studentId = user.id; return user; }, () => ({ studentId }));
}
