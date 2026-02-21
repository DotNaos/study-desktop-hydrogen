import type { Question, UserAnswer } from '../../../types/exercise';
import { CodeQuestion } from './questions/CodeQuestion';
import { FreeTextQuestion } from './questions/FreeTextQuestion';
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion';
import { SingleChoiceQuestion } from './questions/SingleChoiceQuestion';
import { TrueFalseQuestion } from './questions/TrueFalseQuestion';

interface Props {
    question: Question;
    answer?: UserAnswer;
    onAnswer: (answer: UserAnswer) => void;
    isSubmitted: boolean;
    index: number;
}

export function QuestionRenderer({
    question,
    answer,
    onAnswer,
    isSubmitted,
    index,
}: Props) {
    const commonProps = { answer, onAnswer, isSubmitted, index };

    switch (question.type) {
        case 'single_choice':
            return (
                <SingleChoiceQuestion question={question} {...commonProps} />
            );
        case 'multiple_choice':
            return (
                <MultipleChoiceQuestion question={question} {...commonProps} />
            );
        case 'true_false':
            return <TrueFalseQuestion question={question} {...commonProps} />;
        case 'free_text':
            return <FreeTextQuestion question={question} {...commonProps} />;
        case 'code':
            return <CodeQuestion question={question} {...commonProps} />;
        default:
            return null;
    }
}
