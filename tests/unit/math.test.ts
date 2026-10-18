import { describe, expect, it } from 'vitest';
import { Frac } from '@/lib/math/fraction';
import { evalExpr } from '@/lib/math/expr';
import { evaluateArithmeticQuestion, parseOptionValue, texToPlain } from '@/lib/math/parse';

describe('Frac', () => {
  it('normalises and does exact arithmetic', () => {
    expect(new Frac(2, 4).toString()).toBe('1/2');
    expect(new Frac(1, 3).add(new Frac(1, 6)).toString()).toBe('1/2');
    expect(Frac.parse('0.1').add(Frac.parse('0.2')).eq(Frac.parse('0.3'))).toBe(true);
    expect(new Frac(3, 4).div(new Frac(3, 8)).toString()).toBe('2');
  });
  it('rejects division by zero', () => {
    expect(() => new Frac(1, 0)).toThrow();
    expect(() => new Frac(1).div(new Frac(0))).toThrow();
  });
});

describe('evalExpr', () => {
  it('respects order of operations', () => {
    expect(evalExpr('2+3*4').toString()).toBe('14');
    expect(evalExpr('(2+3)*4').toString()).toBe('20');
    expect(evalExpr('10-2-3').toString()).toBe('5');
    expect(evalExpr('2^3^1').toString()).toBe('8');
    expect(evalExpr('-3+5').toString()).toBe('2');
  });
  it('handles exact decimals and fractions', () => {
    expect(evalExpr('0.1+0.2').toString()).toBe('3/10');
    expect(evalExpr('3/4+1/8').toString()).toBe('7/8');
    expect(evalExpr('1.5*4').toString()).toBe('6');
  });
  it('supports helper functions', () => {
    expect(evalExpr('gcd(24,36)').toString()).toBe('12');
    expect(evalExpr('lcm(4,6)').toString()).toBe('12');
    expect(evalExpr('mod(17,5)').toString()).toBe('2');
    expect(evalExpr('nfactors(36)').toString()).toBe('9');
    expect(evalExpr('nprimes(10,30)').toString()).toBe('6');
    expect(evalExpr('ceil(7/2)').toString()).toBe('4');
    expect(evalExpr('max(1/2,2/3,3/5)').toString()).toBe('2/3');
  });
  it('is safe', () => {
    expect(() => evalExpr('process.exit()')).toThrow();
    expect(() => evalExpr('1+')).toThrow();
    expect(() => evalExpr('unknown(3)')).toThrow();
  });
});

describe('parseOptionValue', () => {
  it('does not interpret numbers inside narrative choices as numeric answers', () => {
    expect(parseOptionValue('Đồng ý vì 87% là con số khá cao rồi')).toBeNull();
    expect(parseOptionValue('Yêu cầu dùng đúng con số 87% kèm nguồn khảo sát')).toBeNull();
    expect(parseOptionValue('Liệt kê thành tích của trường trong 20 năm')).toBeNull();
    expect(parseOptionValue('Explain why 3/4 of the team agreed')).toBeNull();
  });
  it('reads common answer formats', () => {
    expect(parseOptionValue('12,345')?.toString()).toBe('12345');
    expect(parseOptionValue('$12.50')?.toString()).toBe('25/2');
    expect(parseOptionValue('\\(\\frac{3}{4}\\)')?.toString()).toBe('3/4');
    expect(parseOptionValue('\\(2\\frac{1}{4}\\)')?.toString()).toBe('9/4');
    expect(parseOptionValue('45%')?.toString()).toBe('45');
    expect(parseOptionValue('3 : 4')?.toString()).toBe('3/4');
    expect(parseOptionValue('2 h 30 min')?.toString()).toBe('150');
    expect(parseOptionValue('12:35 PM')?.toString()).toBe('755');
    expect(parseOptionValue('Wednesday')?.toString()).toBe('3');
    expect(parseOptionValue('24 cm²')?.toString()).toBe('24');
    expect(parseOptionValue('no numbers')).toBeNull();
  });
  it('texToPlain strips markup', () => {
    expect(texToPlain('\\(\\frac{1}{2}\\)')).toBe('1/2');
  });
});

describe('evaluateArithmeticQuestion', () => {
  it('computes pure arithmetic questions', () => {
    expect(evaluateArithmeticQuestion('Calculate \\(24 \\times 3 + 6\\).')?.toString()).toBe('78');
    expect(evaluateArithmeticQuestion('What is \\(\\frac{1}{2} + \\frac{1}{3}\\)?')?.toString()).toBe('5/6');
    expect(evaluateArithmeticQuestion('Find the value of \\(1{,}200 \\div 4\\).')?.toString()).toBe('300');
  });
  it('ignores word problems', () => {
    expect(evaluateArithmeticQuestion('Mai has \\(3\\) apples and buys 4 more. How many?')).toBeNull();
    expect(evaluateArithmeticQuestion('Round \\(4.56\\) to the nearest tenth.')).toBeNull();
  });
});
