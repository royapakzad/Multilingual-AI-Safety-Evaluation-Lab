import { EvaluationRecord, MultilingualEvaluationRecord } from '../types';
import { EVALUATIONS_KEY } from '../constants';

/**
 * Saves a new evaluation record to localStorage and returns the updated list.
 * @param evaluation The new evaluation record to add.
 * @returns The complete, updated list of all evaluation records.
 */
export const saveEvaluationToStorage = (evaluation: EvaluationRecord): EvaluationRecord[] => {
  const existingEvaluations = loadEvaluationsFromStorage();
  const updatedEvaluations = [...existingEvaluations, evaluation];
  try {
    localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(updatedEvaluations));
    console.log(`Evaluation ${evaluation.id} saved. Total evaluations: ${updatedEvaluations.length}`);
  } catch (error) {
    console.error("Error saving evaluations to localStorage:", error);
    // This could happen if localStorage is full or disabled.
    alert("Could not save the evaluation. Your browser's local storage might be full or disabled.");
  }
  return updatedEvaluations;
};

/**
 * Loads all evaluation records from localStorage.
 * @returns An array of evaluation records, or an empty array if none are found or an error occurs.
 */
export const loadEvaluationsFromStorage = (): EvaluationRecord[] => {
  try {
    const evaluationsJson = localStorage.getItem(EVALUATIONS_KEY);
    if (evaluationsJson) {
      // Safely parse the JSON with a try-catch block.
      try {
        const evaluations = JSON.parse(evaluationsJson) as any[];
        // Normalize old data that might be missing labType
        const normalizedEvaluations = evaluations.map(ev => {
            if (!ev.labType && ev.scores?.inconsistency) {
                // This looks like an old multilingual evaluation, let's patch it.
                return { ...ev, labType: 'multilingual' };
            }
            return ev;
        });

        console.log(`Loaded ${evaluations.length} evaluations from localStorage.`);
        return normalizedEvaluations as EvaluationRecord[];
      } catch (parseError) {
        console.error("Error parsing evaluations JSON from localStorage:", parseError);
        // If parsing fails, the data is corrupt. It's safer to remove it.
        try {
          localStorage.removeItem(EVALUATIONS_KEY);
        } catch (removeError) {
          console.error("Failed to remove corrupted evaluations data:", removeError);
        }
        return [];
      }
    }
  } catch (accessError) {
    // This can happen in environments where localStorage is blocked (e.g., private browsing, security settings).
    console.warn("Could not access localStorage to load evaluations:", accessError);
  }
  return []; // Return empty array by default
};