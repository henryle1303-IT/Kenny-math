import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

export type BankDb = typeof prisma | Prisma.TransactionClient;

/** Reuse an existing transaction so an import and its publish either both succeed or both roll back. */
export async function bankTransaction<T>(db: BankDb, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return '$transaction' in db ? db.$transaction(fn, { timeout: 60000, maxWait: 10000 }) : fn(db);
}
