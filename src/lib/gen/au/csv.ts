import { questionIdFor } from '../bank';
import { questionToCsvRow, rowsToCsv } from '../../csv/export';
import type { AuBankRow } from './plan';

/** CSV text (with BOM) for some rows of the Australian bank, in the standard import format. */
export function auRowsToCsv(rows: AuBankRow[]): string {
  return rowsToCsv(
    rows.map((r) => ({
      ...questionToCsvRow(
        {
          questionId: questionIdFor(r.testNumber, r.position), testNumber: r.testNumber, position: r.position, level: r.level, difficulty: r.difficulty, topic: r.topic, skill: r.question.skill,
          questionText: r.question.text, optionA: r.question.options[0], optionB: r.question.options[1], optionC: r.question.options[2], optionD: r.question.options[3],
          correctAnswer: r.question.correctAnswer, explanation: r.question.explanation, commonMistake: r.question.commonMistake, learningTip: r.question.learningTip,
          verifyExpr: r.question.verifyExpr, validationStatus: 'VERIFIED', questionType: r.question.questionType, answerData: r.question.answerData,
        },
        '',
        0,
      ),
      bank_id: '',
      bank_version: '',
    })),
  );
}
