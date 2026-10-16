/** Exact rational arithmetic on safe integers. Throws instead of silently losing precision. */

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a / gcd(a, b) * b);
}

function safe(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error('Arithmetic overflow');
  return n;
}

export class Frac {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d: number = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('Frac requires integers');
    if (d === 0) throw new Error('Division by zero');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = safe(n / g);
    this.d = safe(d / g);
  }

  static of(n: number | Frac): Frac {
    return n instanceof Frac ? n : new Frac(n);
  }

  /** Parse an exact decimal/integer literal such as "12", "-0.375". */
  static parse(s: string): Frac {
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s.trim());
    if (!m) throw new Error(`Bad number literal: ${s}`);
    const frac = m[3] ?? '';
    if (frac.length > 12) throw new Error('Too many decimal places');
    const den = Math.pow(10, frac.length);
    const num = Number(m[2] + frac);
    return new Frac(m[1] ? -num : num, den);
  }

  add(o: Frac | number): Frac {
    const b = Frac.of(o);
    return new Frac(safe(this.n * b.d) + safe(b.n * this.d), safe(this.d * b.d));
  }
  sub(o: Frac | number): Frac {
    const b = Frac.of(o);
    return new Frac(safe(this.n * b.d) - safe(b.n * this.d), safe(this.d * b.d));
  }
  mul(o: Frac | number): Frac {
    const b = Frac.of(o);
    return new Frac(safe(this.n * b.n), safe(this.d * b.d));
  }
  div(o: Frac | number): Frac {
    const b = Frac.of(o);
    if (b.n === 0) throw new Error('Division by zero');
    return new Frac(safe(this.n * b.d), safe(this.d * b.n));
  }
  neg(): Frac {
    return new Frac(-this.n, this.d);
  }
  pow(e: number): Frac {
    if (!Number.isInteger(e) || e < 0 || e > 12) throw new Error('Unsupported exponent');
    let r = new Frac(1);
    for (let i = 0; i < e; i++) r = r.mul(this);
    return r;
  }
  cmp(o: Frac | number): number {
    const b = Frac.of(o);
    const l = safe(this.n * b.d);
    const r = safe(b.n * this.d);
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Frac | number): boolean {
    return this.cmp(o) === 0;
  }
  get isInt(): boolean {
    return this.d === 1;
  }
  get value(): number {
    return this.n / this.d;
  }
  floor(): number {
    return Math.floor(this.n / this.d);
  }
  ceil(): number {
    return Math.ceil(this.n / this.d);
  }
  /** True if the denominator is of the form 2^a * 5^b, i.e. it has a terminating decimal expansion. */
  get terminating(): boolean {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  }
  toString(): string {
    return this.isInt ? String(this.n) : `${this.n}/${this.d}`;
  }
}

export const F = (n: number, d = 1) => new Frac(n, d);
