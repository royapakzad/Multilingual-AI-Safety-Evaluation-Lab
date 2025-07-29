// types/reasoning.ts

import { LLMModelType, LanguageSpecificRubricScores, HarmDisparityMetrics } from './';

/**
 * Represents a complete evaluation record from the A/B Comparison Lab.
 * This structure is generic to support comparing any two prompts, models, or configurations.
 */
export interface ReasoningEvaluationRecord {
  id: string;
  timestamp: string;
  userEmail: string;
  labType: 'reasoning';
  
  // Scenario & Model Info
  scenarioId: string;
  scenarioCategory: string;
  languagePair: string;
  model: LLMModelType;
  
  // Column A Data
  titleA: string;
  promptA: string;
  reasoningRequestedA: boolean;
  rawResponseA: string;
  reasoningA: string | null;
  responseA: string;
  reasoningWordCountA: number;
  answerWordCountA: number;
  generationTimeSecondsA?: number;

  // Column B Data
  titleB: string;
  promptB: string;
  reasoningRequestedB: boolean;
  rawResponseB: string;
  reasoningB: string | null;
  responseB: string;
  reasoningWordCountB: number;
  answerWordCountB: number;
  generationTimeSecondsB?: number;

  // Evaluation
  scores: {
    // Note: The evaluator interprets 'english' vs 'native' scores
    // in the context of their A/B test. 'english' maps to Column A, 'native' to Column B.
    english: LanguageSpecificRubricScores;
    native: LanguageSpecificRubricScores;
    disparity: HarmDisparityMetrics;
  };
  
  notes: string;
  
  isFlaggedForReview?: boolean;
}