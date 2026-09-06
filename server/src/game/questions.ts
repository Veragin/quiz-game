import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TQuestion } from '../types';

/**
 * questions.txt lives at the repo root next to the two packages in dev, and is
 * copied next to the compiled server in the deploy tree (see
 * docker/Dockerfile.build) -- so both layouts are tried, in that order. In the
 * deploy tree the content comes from ../admin/config/quiz.env, which `make
 * build` stages into the build context; the file name stays questions.txt here.
 *
 * __dirname is server/src/game under ts-node and server/dist/game after tsc.
 */
const CANDIDATE_PATHS = [
    join(__dirname, '..', '..', '..', 'questions.txt'),
    join(__dirname, '..', '..', 'questions.txt'),
];

/** Used when questions.txt is missing so a room is never left without a game. */
const FALLBACK_QUESTIONS = [
    'What is your favourite film and why?',
    'What is the strangest thing you have ever eaten?',
    'What would you do with a free year?',
];

const readQuestionLines = (): string[] => {
    for (const path of CANDIDATE_PATHS) {
        try {
            const lines = readFileSync(path, 'utf-8')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
            if (lines.length) return lines;
        } catch {
            // Try the next candidate.
        }
    }
    console.warn('questions.txt not found, falling back to the built-in list');
    return FALLBACK_QUESTIONS;
};

/** Read once at boot; every room starts from a copy so edits stay per-room. */
const defaultQuestionTexts = readQuestionLines();

export const toQuestions = (texts: string[]): TQuestion[] =>
    texts.map((text) => ({ id: uuidv4(), text }));

export const getDefaultQuestions = (): TQuestion[] => toQuestions(defaultQuestionTexts);
