import type { QuestionData } from '../validate/question';

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = '123';
export const DEMO_BANK_NAME = 'Demo - all question types';
export const DEMO_TESTS = [1, 11, 21] as const;

type Base = Pick<QuestionData, 'topic' | 'skill' | 'difficulty' | 'questionText' | 'explanation' | 'commonMistake' | 'learningTip'>;

let pos = 0;
let lastTest = 0;
function slot(testNumber: number) {
  if (testNumber !== lastTest) {
    lastTest = testNumber;
    pos = 0;
  }
  pos++;
  return { questionId: `DEMO-T${String(testNumber).padStart(2, '0')}-Q${String(pos).padStart(2, '0')}`, testNumber, position: pos, level: testNumber <= 10 ? 'Beginner' : testNumber <= 20 ? 'Intermediate' : 'Advanced' };
}

function mcq(t: number, b: Base, options: [string, string, string, string], correct: 'A' | 'B' | 'C' | 'D', verifyExpr: string | null): QuestionData {
  return { ...slot(t), ...b, options, correctAnswer: correct, verifyExpr, questionType: 'MCQ', answerData: null };
}
function typed(t: number, type: string, b: Base, def: unknown, verifyExpr: string | null = null): QuestionData {
  return { ...slot(t), ...b, options: ['', '', '', ''], correctAnswer: '', verifyExpr, questionType: type, answerData: JSON.stringify(def) };
}

export function demoQuestions(): QuestionData[] {
  pos = 0;
  lastTest = 0;
  return [
    // ---- Test 1 (Beginner) --------------------------------------------------------------
    mcq(1, { topic: 'Whole Numbers', skill: 'wn.addsub', difficulty: 1, questionText: 'Calculate \\(345 + 128\\).', explanation: 'What it asks: Find the total.\nStep 1: 345 + 100 = 445.\nStep 2: 445 + 28 = 473.\nAnswer: 473', commonMistake: 'Forgetting to carry the extra ten.', learningTip: 'Add the hundreds first, then the tens, then the ones.' }, ['463', '473', '483', '372'], 'B', '345+128'),
    typed(1, 'NUMERIC_INPUT', { topic: 'Whole Numbers', skill: 'wn.muldiv', difficulty: 1, questionText: 'What is \\(12 \\times 7\\)? Type the number.', explanation: 'What it asks: Multiply 12 by 7.\nStep 1: 10 x 7 = 70.\nStep 2: 2 x 7 = 14.\nStep 3: 70 + 14 = 84.\nAnswer: 84', commonMistake: 'Mixing up the 7 times table.', learningTip: 'Split 12 into 10 and 2, then add the two answers.' }, { accepted: ['84'] }, '12*7'),
    typed(1, 'TRUE_FALSE', { topic: 'Fractions', skill: 'fr.compare', difficulty: 2, questionText: 'Say whether each statement is true or false.', explanation: 'Statement 1: halves are bigger than thirds, so it is true.\nStatement 2: 0.5 is bigger than 0.25, so it is false.\nAnswer: True, False', commonMistake: 'Thinking a bigger denominator means a bigger fraction.', learningTip: 'The more pieces a whole is cut into, the smaller each piece is.' }, { statements: [{ text: '\\(\\frac{1}{2} > \\frac{1}{3}\\)', truth: true }, { text: '0.5 is less than 0.25', truth: false }] }),
    typed(1, 'MULTI_SELECT', { topic: 'Whole Numbers', skill: 'wn.factors', difficulty: 2, questionText: 'Choose ALL the multiples of 3.', explanation: 'Count in threes: 3, 6, 9, 12, 15.\nSo 6, 9 and 12 are multiples of 3; 8 and 10 are not.\nAnswer: 6, 9, 12', commonMistake: 'Choosing only the first multiple you notice.', learningTip: 'A number is a multiple of 3 when its digits add up to a multiple of 3.' }, { options: ['6', '8', '9', '10', '12'], correct: [0, 2, 4] }),
    typed(1, 'SHORT_TEXT', { topic: 'Geometry', skill: 'ge.perimeter', difficulty: 1, questionText: 'What is the name of a shape with 4 equal sides and 4 right angles?', explanation: 'A shape with four equal sides and four right angles is a square.\nAnswer: square', commonMistake: 'Answering rectangle, which does not need equal sides.', learningTip: 'Every square is a rectangle, but not every rectangle is a square.' }, { accepted: ['square'] }),
    typed(1, 'ORDERING', { topic: 'Decimals', skill: 'dec.compare', difficulty: 2, questionText: 'Put these numbers in order from smallest to largest.', explanation: 'Write them in hundredths: 0.20, 0.25, 0.30, 0.50.\nAnswer: 0.2, 0.25, 0.3, 0.5', commonMistake: 'Thinking 0.25 is bigger than 0.3 because 25 is bigger than 3.', learningTip: 'Give every number the same number of decimal places before comparing.' }, { items: ['0.2', '0.25', '0.3', '0.5'] }),
    // ---- Test 11 (Intermediate) -----------------------------------------------------------
    typed(11, 'NUMERIC_INPUT', { topic: 'Fractions', skill: 'fr.addsub', difficulty: 2, questionText: 'Calculate \\(\\frac{1}{4} + \\frac{1}{2}\\). Type your answer as a fraction or a decimal.', explanation: 'What it asks: Add two fractions.\nStep 1: \\(\\frac{1}{2} = \\frac{2}{4}\\).\nStep 2: \\(\\frac{1}{4} + \\frac{2}{4} = \\frac{3}{4}\\).\nAnswer: 3/4 (or 0.75)', commonMistake: 'Adding the numerators and the denominators.', learningTip: 'Make the denominators the same before adding.' }, { accepted: ['3/4', '0.75'] }, '1/4+1/2'),
    mcq(11, { topic: 'Geometry', skill: 'ge.area', difficulty: 2, questionText: 'A rectangle is 8 cm long and 5 cm wide. What is its area?', explanation: 'What it asks: Find the area.\nStep 1: Area = length x width.\nStep 2: 8 x 5 = 40.\nAnswer: 40 cm²', commonMistake: 'Adding the sides instead of multiplying.', learningTip: 'Area is measured in square units.' }, ['13 cm²', '26 cm²', '40 cm²', '45 cm²'], 'C', '8*5'),
    typed(11, 'FILL_BLANK', { topic: 'Fractions', skill: 'fr.addsub', difficulty: 3, questionText: 'Fill in the blanks: \\(\\frac{3}{4} + \\frac{1}{4} = \\) {1}, and \\(2 \\times 5 = \\) {2}.', explanation: 'Three quarters plus one quarter is one whole, and 2 x 5 = 10.\nAnswer: 1, 10', commonMistake: 'Writing 4/8 for the first blank.', learningTip: 'When the denominators match, add only the numerators.' }, { blanks: [{ accepted: ['1'] }, { accepted: ['10'] }] }),
    typed(11, 'TRUE_FALSE', { topic: 'Percentages', skill: 'pc.of', difficulty: 3, questionText: 'Decide whether each statement about percentages is true or false.', explanation: '50% is half, and half of 80 is 40: true.\n10% of 200 is 20, not 2: false.\n25% is one quarter: true.\nAnswer: True, False, True', commonMistake: 'Moving the decimal point the wrong way when finding 10%.', learningTip: '10% means divide by 10; 50% means halve; 25% means halve twice.' }, { statements: [{ text: '50% of 80 is 40', truth: true }, { text: '10% of 200 is 2', truth: false }, { text: '25% is the same as \\(\\frac{1}{4}\\)', truth: true }] }),
    typed(11, 'MULTI_SELECT', { topic: 'Fractions', skill: 'fr.forms', difficulty: 3, questionText: 'Choose ALL the fractions that are equal to \\(\\frac{1}{2}\\).', explanation: '\\(\\frac{2}{4}\\) and \\(\\frac{4}{8}\\) both simplify to one half; the others do not.\nAnswer: 2/4 and 4/8', commonMistake: 'Choosing fractions that are only close to one half.', learningTip: 'The top number must be exactly half of the bottom number.' }, { options: ['\\(\\frac{2}{4}\\)', '\\(\\frac{3}{5}\\)', '\\(\\frac{4}{8}\\)', '\\(\\frac{5}{12}\\)'], correct: [0, 2] }),
    typed(11, 'ORDERING', { topic: 'Fractions', skill: 'fr.compare', difficulty: 3, questionText: 'Put these fractions in order from smallest to largest.', explanation: 'Use twelfths: 3/12, 4/12, 6/12, 9/12.\nAnswer: 1/4, 1/3, 1/2, 3/4', commonMistake: 'Comparing only the denominators.', learningTip: 'Change every fraction to the same denominator to compare them.' }, { items: ['\\(\\frac{1}{4}\\)', '\\(\\frac{1}{3}\\)', '\\(\\frac{1}{2}\\)', '\\(\\frac{3}{4}\\)'] }),
    // ---- Test 21 (Advanced) -----------------------------------------------------------------
    typed(21, 'NUMERIC_INPUT', { topic: 'Multi-step Problems', skill: 'ms.money', difficulty: 4, questionText: 'Anna buys 3 books at $4.50 each and pays with a $20 note. How many dollars of change does she get? Type the number.', explanation: 'Step 1: 3 x 4.50 = 13.50.\nStep 2: 20 - 13.50 = 6.50.\nAnswer: 6.5', commonMistake: 'Forgetting to multiply by 3 before subtracting.', learningTip: 'Find the total cost first, then take it away from what was paid.' }, { accepted: ['6.5', '6.50'] }, '20-3*4.5'),
    mcq(21, { topic: 'Word Problems', skill: 'wp.average', difficulty: 4, questionText: 'The average of 4 numbers is 15. Three of the numbers are 10, 12 and 20. What is the fourth number?', explanation: 'Step 1: The total of 4 numbers is 4 x 15 = 60.\nStep 2: The three known numbers add to 42.\nStep 3: 60 - 42 = 18.\nAnswer: 18', commonMistake: 'Averaging the three known numbers instead of using the total.', learningTip: 'Total = average x how many numbers.' }, ['15', '16', '18', '20'], 'C', '15*4-10-12-20'),
    typed(21, 'SHORT_TEXT', { topic: 'Geometry', skill: 'ge.volume', difficulty: 4, questionText: 'Which 3D shape has exactly 6 faces that are all squares?', explanation: 'A cube has six identical square faces.\nAnswer: cube', commonMistake: 'Answering cuboid, whose faces are rectangles.', learningTip: 'Count the faces, then check their shapes.' }, { accepted: ['cube'] }),
    typed(21, 'FILL_BLANK', { topic: 'Patterns', skill: 'pa.arith', difficulty: 4, questionText: 'Complete the pattern: 3, 7, 11, {1}, 19, {2}.', explanation: 'The pattern goes up by 4 each time.\n11 + 4 = 15 and 19 + 4 = 23.\nAnswer: 15, 23', commonMistake: 'Adding 3 instead of finding the real step.', learningTip: 'Subtract neighbouring terms to find the step.' }, { blanks: [{ accepted: ['15'] }, { accepted: ['23'] }] }),
    typed(21, 'MULTI_SELECT', { topic: 'Whole Numbers', skill: 'wn.factors', difficulty: 5, questionText: 'Choose ALL the prime numbers.', explanation: '2, 11 and 17 only have two factors (1 and themselves).\n9 = 3 x 3 and 15 = 3 x 5 are not prime.\nAnswer: 2, 11, 17', commonMistake: 'Thinking 9 is prime because it is odd.', learningTip: 'Try dividing by 2, 3 and 5 first.' }, { options: ['2', '9', '11', '15', '17'], correct: [0, 2, 4] }),
    typed(21, 'ORDERING', { topic: 'Time & Speed', skill: 'ts.convert', difficulty: 5, questionText: 'Put these times in order from shortest to longest.', explanation: 'In seconds: 90, 120, 150 and 3600.\nAnswer: 90 seconds, 2 minutes, 150 seconds, 1 hour', commonMistake: 'Comparing the numbers without the units.', learningTip: 'Change everything to seconds before comparing.' }, { items: ['90 seconds', '2 minutes', '150 seconds', '1 hour'] }),
  ];
}
