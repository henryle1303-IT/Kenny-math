import { NextResponse } from 'next/server';
import { AppError } from './services/attempts';

/** Uniform JSON error handling: friendly messages, no stack traces. */
export async function handle<T>(fn: () => Promise<T>, init?: ResponseInit): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data, init);
  } catch (e) {
    return errorResponse(e);
  }
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  console.error('[api error]', e);
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again.', code: 'INTERNAL' }, { status: 500 });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError('The request was not valid.');
  }
}
