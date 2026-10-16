import { Frac, gcd, lcm } from './fraction';

/**
 * A tiny, safe, exact expression evaluator used to independently verify answers.
 * Supports + - * / ^ ( ) decimal literals and a handful of whitelisted functions.
 * No eval(), no variables.
 */

type Tok = { t: 'num' | 'op' | 'id' | 'lp' | 'rp' | 'comma'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
    } else if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else if (c === '(') {
      out.push({ t: 'lp', v: c });
      i++;
    } else if (c === ')') {
      out.push({ t: 'rp', v: c });
      i++;
    } else if (c === ',') {
      out.push({ t: 'comma', v: c });
      i++;
    } else if (/[a-z]/i.test(c)) {
      let j = i;
      while (j < src.length && /[a-z0-9_]/i.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j).toLowerCase() });
      i = j;
    } else {
      throw new Error(`Unexpected character "${c}"`);
    }
  }
  return out;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

function intArg(f: Frac, name: string): number {
  if (!f.isInt) throw new Error(`${name} needs whole-number arguments`);
  return f.n;
}

const FUNCS: Record<string, (a: Frac[]) => Frac> = {
  max: (a) => a.reduce((m, x) => (x.cmp(m) > 0 ? x : m)),
  min: (a) => a.reduce((m, x) => (x.cmp(m) < 0 ? x : m)),
  abs: (a) => (a[0].n < 0 ? a[0].neg() : a[0]),
  floor: (a) => new Frac(a[0].floor()),
  ceil: (a) => new Frac(a[0].ceil()),
  round: (a) => new Frac(a[0].add(new Frac(1, 2)).floor()),
  mod: (a) => {
    const x = intArg(a[0], 'mod');
    const y = intArg(a[1], 'mod');
    return new Frac(((x % y) + y) % y);
  },
  gcd: (a) => new Frac(gcd(intArg(a[0], 'gcd'), intArg(a[1], 'gcd'))),
  lcm: (a) => new Frac(lcm(intArg(a[0], 'lcm'), intArg(a[1], 'lcm'))),
  sqrt: (a) => {
    const x = a[0];
    const nr = Math.round(Math.sqrt(x.n));
    const dr = Math.round(Math.sqrt(x.d));
    if (nr * nr !== x.n || dr * dr !== x.d) throw new Error('sqrt only supports perfect squares');
    return new Frac(nr, dr);
  },
  nfactors: (a) => {
    const n = intArg(a[0], 'nfactors');
    let c = 0;
    for (let i = 1; i <= n; i++) if (n % i === 0) c++;
    return new Frac(c);
  },
  nprimes: (a) => {
    const lo = intArg(a[0], 'nprimes');
    const hi = intArg(a[1], 'nprimes');
    let c = 0;
    for (let i = lo; i <= hi; i++) if (isPrime(i)) c++;
    return new Frac(c);
  },
  digitsum: (a) =>
    new Frac(
      String(Math.abs(intArg(a[0], 'digitsum')))
        .split('')
        .reduce((s, d) => s + Number(d), 0),
    ),
};

export function evalExpr(src: string): Frac {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  function parseExpr(): Frac {
    let v = parseTerm();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const r = parseTerm();
      v = op === '+' ? v.add(r) : v.sub(r);
    }
    return v;
  }
  function parseTerm(): Frac {
    let v = parseUnary();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = next().v;
      const r = parseUnary();
      v = op === '*' ? v.mul(r) : v.div(r);
    }
    return v;
  }
  function parseUnary(): Frac {
    if (peek() && peek().t === 'op' && peek().v === '-') {
      next();
      return parseUnary().neg();
    }
    if (peek() && peek().t === 'op' && peek().v === '+') {
      next();
      return parseUnary();
    }
    return parsePow();
  }
  function parsePow(): Frac {
    const base = parseAtom();
    if (peek() && peek().t === 'op' && peek().v === '^') {
      next();
      const e = parseUnary();
      if (!e.isInt) throw new Error('Non-integer exponent');
      return base.pow(e.n);
    }
    return base;
  }
  function parseAtom(): Frac {
    const t = next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.t === 'num') return Frac.parse(t.v);
    if (t.t === 'lp') {
      const v = parseExpr();
      if (next()?.t !== 'rp') throw new Error('Missing )');
      return v;
    }
    if (t.t === 'id') {
      const fn = FUNCS[t.v];
      if (!fn) throw new Error(`Unknown function ${t.v}`);
      if (next()?.t !== 'lp') throw new Error('Expected (');
      const args: Frac[] = [parseExpr()];
      while (peek() && peek().t === 'comma') {
        next();
        args.push(parseExpr());
      }
      if (next()?.t !== 'rp') throw new Error('Missing )');
      return fn(args);
    }
    throw new Error(`Unexpected token ${t.v}`);
  }

  const v = parseExpr();
  if (p !== toks.length) throw new Error('Unexpected trailing input');
  return v;
}
