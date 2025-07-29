
/**
 * A system instruction that prompts the model to provide a step-by-step reasoning process
 * in a specific XML tag before giving the final answer.
 */
export const REASONING_SYSTEM_INSTRUCTION = 'First, in a section titled "## Reasoning", provide your step-by-step thinking process. Then, in a separate section titled "## Answer", provide the final, user-facing response. Your entire output must contain both sections.';
