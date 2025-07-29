
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { 
    User, ReasoningEvaluationRecord, LLMModelType, 
    LanguageSpecificRubricScores, HarmDisparityMetrics, 
    VerifiableEntity, RubricDimension, CsvScenario
} from '../types';
import { 
    EVALUATIONS_KEY, AVAILABLE_MODELS, REASONING_SYSTEM_INSTRUCTION, 
    INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES, INITIAL_HARM_DISPARITY_METRICS,
    AVAILABLE_NATIVE_LANGUAGES, RUBRIC_DIMENSIONS, HARM_SCALE, YES_NO_UNSURE_OPTIONS, DISPARITY_CRITERIA
} from '../constants';
import * as config from '../env.js';
import LoadingSpinner from './LoadingSpinner';
import ModelSelector from './ModelSelector';
import EvaluationForm from './EvaluationForm';
import ReasoningDashboard from './ReasoningDashboard'; 
import Tooltip from './Tooltip';
import { generateLlmResponse, translateText } from '../services/llmService';
import { analyzeTextResponse } from '../services/textAnalysisService';
import { saveEvaluationToStorage, loadEvaluationsFromStorage } from '../services/evaluationService';

// --- HELPER COMPONENTS ---

const createMarkup = (markdownText: string | undefined | null) => {
    if (!markdownText) return { __html: '<em class="text-muted-foreground opacity-75">No content available.</em>' };
    const rawMarkup = marked(markdownText, { breaks: true, gfm: true });
    return { __html: DOMPurify.sanitize(rawMarkup as string) };
};

const ReasoningResponseCard: React.FC<{ 
  title: string;
  response: string | null;
  reasoning: string | null;
  isLoading: boolean; 
  generationTime?: number | null;
  answerWordCount?: number;
  reasoningWordCount?: number;
}> = ({ title, response, reasoning, isLoading, generationTime, answerWordCount, reasoningWordCount }) => (
    <div className="bg-card text-card-foreground p-6 rounded-xl shadow-md border border-border flex-1 min-h-[300px] flex flex-col">
        <div className="flex justify-between items-start mb-3.5 border-b border-border pb-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
                {title}
            </h3>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                {generationTime != null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Generation Time">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg>
                        <span>{generationTime.toFixed(2)}s</span>
                    </div>
                )}
                 {reasoningWordCount != null && reasoningWordCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Reasoning Word Count">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path d="M10.75 4.75a.75.75 0 00-1.5 0v.511c-1.12.373-2.153 1.14-2.83 2.186A3.001 3.001 0 005 10c0 1.657 1.343 3 3 3s3-1.343 3-3a3.001 3.001 0 00-2.42-2.955c-.677-1.046-1.71-1.813-2.83-2.186V4.75zM8 10a2 2 0 104 0 2 2 0 00-4 0z" /></svg>
                        <span>{reasoningWordCount} reasoning words</span>
                    </div>
                )}
                {answerWordCount != null && answerWordCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Answer Word Count">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path d="M5.75 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M9.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M13.25 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M17 6.5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 0117 6.5z" /></svg>
                        <span>{answerWordCount} answer words</span>
                    </div>
                )}
            </div>
        </div>
        {isLoading ? (
            <div className="text-muted-foreground text-sm flex-grow flex flex-col items-center justify-center space-y-3">
                <LoadingSpinner size="md" color="text-primary" />
                <span>Generating response...</span>
            </div>
        ) : (
            <div className="flex-grow flex flex-col space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {reasoning && (
                    <details className="border border-blue-200 dark:border-blue-800/60 rounded-lg group bg-blue-50 dark:bg-blue-900/20">
                        <summary className="p-3 cursor-pointer list-none flex items-center text-sm font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-t-lg select-none">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2 flex-shrink-0"><path d="M10.75 4.75a.75.75 0 00-1.5 0v.511c-1.12.373-2.153 1.14-2.83 2.186A3.001 3.001 0 005 10c0 1.657 1.343 3 3 3s3-1.343 3-3a3.001 3.001 0 00-2.42-2.955c-.677-1.046-1.71-1.813-2.83-2.186V4.75zM8 10a2 2 0 104 0 2 2 0 00-4 0z" /><path fillRule="evenodd" d="M10 2a.75.75 0 00-1.75.75v.284a5.503 5.503 0 00-3.352 4.466 2.75 2.75 0 00-1.652 2.508 2.75 2.75 0 002.75 2.75 2.75 2.75 0 002.75-2.75 2.75 2.75 0 00-1.652-2.508A5.503 5.503 0 008.25 3.034V2.75A.75.75 0 0010 2zM12.25 10a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" clipRule="evenodd" /></svg>
                            Show/Hide Reasoning
                        </summary>
                         <div 
                            className="p-3 border-t border-blue-200 dark:border-blue-800/60 bg-white dark:bg-card/30 max-h-56 overflow-y-auto custom-scrollbar prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={createMarkup(reasoning)}
                        />
                    </details>
                )}
                 <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{reasoning ? 'Final Answer:' : 'Response:'}</h4>
                    <div 
                        className="prose dark:prose-invert max-w-none prose-p:my-2 prose-headings:text-foreground prose-strong:text-foreground text-card-foreground text-base leading-relaxed"
                        dangerouslySetInnerHTML={createMarkup(response)}
                    />
                 </div>
            </div>
        )}
    </div>
);


const SetupColumn: React.FC<{
    title: string; onTitleChange: (v: string) => void;
    prompt: string; onPromptChange: (v: string) => void;
    requestReasoning: boolean; onRequestReasoningChange: (v: boolean) => void;
    columnId: 'A' | 'B';
}> = ({ title, onTitleChange, prompt, onPromptChange, requestReasoning, onRequestReasoningChange, columnId }) => (
    <div className="space-y-4 bg-background p-4 rounded-lg border border-border/60">
        <div>
            <label htmlFor={`title_${columnId}`} className="block text-sm font-medium text-foreground mb-1">
                Column {columnId} Title
            </label>
            <input
                id={`title_${columnId}`}
                type="text"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                className="form-input w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                placeholder={`e.g., English w/ Reasoning`}
            />
        </div>
        <div>
            <label htmlFor={`prompt_${columnId}`} className="block text-sm font-medium text-foreground mb-1">
                Prompt
            </label>
            <textarea
                id={`prompt_${columnId}`}
                rows={6}
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                className="form-textarea w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                placeholder={`Enter prompt for Column ${columnId} here...`}
            />
        </div>
        <div className="flex items-center space-x-2">
            <input
                id={`reasoning_${columnId}`}
                type="checkbox"
                checked={requestReasoning}
                onChange={e => onRequestReasoningChange(e.target.checked)}
                className="form-checkbox h-4 w-4 rounded text-primary border-border bg-card focus:ring-ring"
            />
            <label htmlFor={`reasoning_${columnId}`} className="block text-sm text-foreground">
                Request explicit reasoning
            </label>
            <Tooltip content={<div className="space-y-2">
                <p>When checked, the following system instruction is sent to the model:</p>
                <pre className="text-xs bg-muted text-muted-foreground p-2 rounded whitespace-pre-wrap font-mono">{REASONING_SYSTEM_INSTRUCTION}</pre>
                </div>
            }>
                <span className="text-muted-foreground cursor-help border border-dashed border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs">?</span>
            </Tooltip>
        </div>
    </div>
);


// --- MAIN COMPONENT ---

interface ReasoningLabProps {
    currentUser: User;
}

const ReasoningLab: React.FC<ReasoningLabProps> = ({ currentUser }) => {
  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');

  // Input Mode State
  const [inputMode, setInputMode] = useState<'custom' | 'csv'>('custom');
  const [csvScenarios, setCsvScenarios] = useState<CsvScenario[]>([]);
  const [selectedCsvScenarioId, setSelectedCsvScenarioId] = useState<string>('');
  const [csvError, setCsvError] = useState<string | null>(null);

  // Language State
  const [selectedNativeLanguageCode, setSelectedNativeLanguageCode] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  
  // Setup State
  const [selectedModel, setSelectedModel] = useState<LLMModelType>(AVAILABLE_MODELS[0].id);
  const [titleA, setTitleA] = useState('English');
  const [promptA, setPromptA] = useState('');
  const [requestReasoningA, setRequestReasoningA] = useState(true);
  const [titleB, setTitleB] = useState('Native Language');
  const [promptB, setPromptB] = useState('');
  const [requestReasoningB, setRequestReasoningB] = useState(true);

  // API & Response State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  const [rawResponseA, setRawResponseA] = useState<string>('');
  const [responseA, setResponseA] = useState<string | null>(null);
  const [reasoningA, setReasoningA] = useState<string | null>(null);
  const [rawResponseB, setRawResponseB] = useState<string>('');
  const [responseB, setResponseB] = useState<string | null>(null);
  const [reasoningB, setReasoningB] = useState<string | null>(null);
  
  const [generationTimeA, setGenerationTimeA] = useState<number | null>(null);
  const [generationTimeB, setGenerationTimeB] = useState<number | null>(null);
  const [answerWordCountA, setAnswerWordCountA] = useState<number>(0);
  const [answerWordCountB, setAnswerWordCountB] = useState<number>(0);
  const [reasoningWordCountA, setReasoningWordCountA] = useState<number>(0);
  const [reasoningWordCountB, setReasoningWordCountB] = useState<number>(0);
  
  // Evaluation State
  const [currentScoresA, setCurrentScoresA] = useState<LanguageSpecificRubricScores>({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
  const [currentScoresB, setCurrentScoresB] = useState<LanguageSpecificRubricScores>({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
  const [currentHarmDisparityMetrics, setCurrentHarmDisparityMetrics] = useState<HarmDisparityMetrics>({...INITIAL_HARM_DISPARITY_METRICS});
  const [evaluationNotes, setEvaluationNotes] = useState<string>('');
  const [allEvaluations, setAllEvaluations] = useState<ReasoningEvaluationRecord[]>([]);
  const [isManuallyFlaggedForReview, setIsManuallyFlaggedForReview] = useState<boolean>(false);
  
  const translationDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial data load
  useEffect(() => {
    const allSaved = loadEvaluationsFromStorage();
    setAllEvaluations(allSaved.filter(ev => ev.labType === 'reasoning') as ReasoningEvaluationRecord[]);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const resetEvaluationState = () => {
    setCurrentScoresA({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
    setCurrentScoresB({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
    setCurrentHarmDisparityMetrics({...INITIAL_HARM_DISPARITY_METRICS});
    setEvaluationNotes('');
    setGenerationTimeA(null); setGenerationTimeB(null);
    setAnswerWordCountA(0); setAnswerWordCountB(0);
    setReasoningWordCountA(0); setReasoningWordCountB(0);
    setIsManuallyFlaggedForReview(false);
    setReasoningA(null); setReasoningB(null);
  };

  const resetForNewRun = () => {
      setRawResponseA(''); setRawResponseB('');
      setResponseA(null); setResponseB(null);
      resetEvaluationState();
  };
  
  const handleNativeLanguageSelect = (languageCode: string) => {
    setSelectedNativeLanguageCode(languageCode);
    setTranslationError(null);
    setTitleB(AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === languageCode)?.name || 'Native Language');
  };

  // Auto-translation effect
  useEffect(() => {
    if (!promptA.trim()) {
        setPromptB(''); // Clear native prompt if English prompt is empty
    }
    if (!promptA.trim() || !selectedNativeLanguageCode) {
      if (translationDebounceTimer.current) clearTimeout(translationDebounceTimer.current);
      return;
    }

    if (translationDebounceTimer.current) {
      clearTimeout(translationDebounceTimer.current);
    }
    translationDebounceTimer.current = setTimeout(async () => {
        setIsTranslating(true);
        setTranslationError(null);
        try {
          const translated = await translateText(promptA, 'en', selectedNativeLanguageCode);
          setPromptB(translated);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown translation error";
          setTranslationError(`Translation failed: ${msg}. Please enter manually.`);
          setPromptB('');
        } finally {
          setIsTranslating(false);
        }
    }, 750);

     return () => {
        if (translationDebounceTimer.current) clearTimeout(translationDebounceTimer.current);
     }
  }, [promptA, selectedNativeLanguageCode]);


  const parseReasoningAndAnswer = (responseText: string): { reasoning: string | null, answer: string } => {
    if (!responseText) return { reasoning: null, answer: '' };
    const reasoningRegex = /#+\s*Reasoning\s*#*\n?([\s\S]*?)(?=#+\s*Answer|$)/i;
    const answerRegex = /#+\s*Answer\s*#*\n?([\s\S]*)/i;
    const reasoningMatch = responseText.match(reasoningRegex);
    const answerMatch = responseText.match(answerRegex);
    if (!reasoningMatch) { // If reasoning not explicitly found, treat whole text as answer
      return { reasoning: null, answer: responseText };
    }
    const reasoning = reasoningMatch[1].trim();
    const answer = answerMatch ? answerMatch[1].trim() : responseText.replace(reasoningMatch[0], '').trim();
    return { reasoning, answer };
  };
  
  const countWords = (text: string | null) => text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  
  const convertToVerifiable = (text: string): VerifiableEntity[] => {
      if (!text) return [];
      const { mentioned_links_list, mentioned_emails_list, mentioned_phones_list, physical_addresses_list } = analyzeTextResponse(text);
      const entities: VerifiableEntity[] = [];
      mentioned_links_list.forEach(value => entities.push({ id: `link-${Math.random()}`, value, type: 'link', status: 'unchecked'}));
      mentioned_emails_list.forEach(value => entities.push({ id: `email-${Math.random()}`, value, type: 'email', status: 'unchecked'}));
      mentioned_phones_list.forEach(value => entities.push({ id: `phone-${Math.random()}`, value, type: 'phone', status: 'unchecked'}));
      physical_addresses_list.forEach(value => entities.push({ id: `address-${Math.random()}`, value, type: 'address', status: 'unchecked'}));
      return entities;
  };

  const handleRunExperiment = async () => {
    if (!promptA.trim() || !promptB.trim()) {
      setError("Please fill in both prompts before running the experiment.");
      return;
    }
    setIsLoading(true); setError(null); resetForNewRun();
    
    const langInfo = AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === selectedNativeLanguageCode);
    const nativeLanguageName = langInfo ? langInfo.name : 'the selected native language';

    const configA = requestReasoningA ? { systemInstruction: REASONING_SYSTEM_INSTRUCTION } : {};
    let configB = {};
    if (requestReasoningB) {
        const reasoningInstructionB = `First, in a section titled "## Reasoning", provide your step-by-step thinking process in ${nativeLanguageName}. Then, in a separate section titled "## Answer", provide the final, user-facing response. Your entire output must contain both sections.`;
        configB = { systemInstruction: reasoningInstructionB };
    }
    
    try {
        const startTimeA = performance.now();
        const resA = await generateLlmResponse(promptA, selectedModel, configA);
        const endTimeA = performance.now();
        setGenerationTimeA((endTimeA - startTimeA) / 1000);
        
        const startTimeB = performance.now();
        const resB = await generateLlmResponse(promptB, selectedModel, configB);
        const endTimeB = performance.now();
        setGenerationTimeB((endTimeB - startTimeB) / 1000);
        
        setRawResponseA(resA);
        const parsedA = parseReasoningAndAnswer(requestReasoningA ? resA : resA);
        setReasoningA(parsedA.reasoning);
        setResponseA(parsedA.answer);
        setReasoningWordCountA(countWords(parsedA.reasoning));
        setAnswerWordCountA(countWords(parsedA.answer));
        setCurrentScoresA(prev => ({...prev, entities: convertToVerifiable(parsedA.answer)}));

        setRawResponseB(resB);
        const parsedB = parseReasoningAndAnswer(requestReasoningB ? resB : resB);
        setReasoningB(parsedB.reasoning);
        setResponseB(parsedB.answer);
        setReasoningWordCountB(countWords(parsedB.reasoning));
        setAnswerWordCountB(countWords(parsedB.answer));
        setCurrentScoresB(prev => ({...prev, entities: convertToVerifiable(parsedB.answer)}));

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false); setCooldown(8);
    }
  };

  const handleEvaluationSubmit = () => {
      if (responseA === null || responseB === null) {
          alert("Responses must be generated before submitting."); return;
      }
      const langInfo = AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === selectedNativeLanguageCode);
      
      const scenarioId = inputMode === 'csv' ? `csv-scenario-${selectedCsvScenarioId}` : 'custom';
      const scenarioCategory = inputMode === 'csv' ? 'CSV Upload' : 'Custom';
      
      const newRecord: ReasoningEvaluationRecord = {
          id: `${new Date().toISOString()}-reasoning-${Math.random().toString(16).slice(2)}`,
          timestamp: new Date().toISOString(),
          userEmail: currentUser.email,
          labType: 'reasoning',
          
          scenarioId: scenarioId,
          scenarioCategory: scenarioCategory,
          languagePair: `English - ${langInfo?.name || "N/A"}`,
          model: selectedModel,
          
          titleA, promptA, reasoningRequestedA: requestReasoningA, rawResponseA, reasoningA, responseA,
          reasoningWordCountA, answerWordCountA, generationTimeSecondsA: generationTimeA,
        
          titleB, promptB, reasoningRequestedB: requestReasoningB, rawResponseB, reasoningB, responseB,
          reasoningWordCountB, answerWordCountB, generationTimeSecondsB: generationTimeB,

          scores: {
              english: currentScoresA, 
              native: currentScoresB,
              disparity: currentHarmDisparityMetrics,
          },
          
          notes: evaluationNotes,
          
          isFlaggedForReview: isManuallyFlaggedForReview,
      };
      const allSaved = saveEvaluationToStorage(newRecord as any);
      setAllEvaluations(allSaved.filter(ev => ev.labType === 'reasoning') as ReasoningEvaluationRecord[]);
      alert("Evaluation saved!");
      resetForNewRun();
  };
  
  const handleToggleFlagForReview = (evaluationId: string) => {
    const updatedEvaluations = allEvaluations.map(ev => {
        if (ev.id === evaluationId) return { ...ev, isFlaggedForReview: !ev.isFlaggedForReview };
        return ev;
    });
    setAllEvaluations(updatedEvaluations);
    try {
        const existingData = loadEvaluationsFromStorage();
        const finalData = existingData.map(ev => updatedEvaluations.find(upd => upd.id === ev.id) || ev);
        localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(finalData));
    } catch (e) {
        console.error("Failed to update flag status in localStorage:", e);
    }
  };
  
  const isRunExperimentDisabled = () => {
    if (isLoading || cooldown > 0 || isTranslating) return true;
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    if (modelInfo) {
      if (modelInfo.provider === 'gemini' && (!config.API_KEY || (config.API_KEY as string) === "YOUR_GOOGLE_GEMINI_API_KEY_HERE")) return true;
      if (modelInfo.provider === 'openai' && (!config.OPENAI_API_KEY || (config.OPENAI_API_KEY as string) === "YOUR_OPENAI_API_KEY_HERE")) return true;
      if (modelInfo.provider === 'mistral' && (!config.MISTRAL_API_KEY || (config.MISTRAL_API_KEY as string) === "YOUR_MISTRAL_API_KEY_HERE")) return true;
    }
    return !promptA.trim() || !promptB.trim();
  };

  const getButtonText = () => {
    if (isTranslating) return <><LoadingSpinner size="sm" color="text-primary-foreground" className="mr-2.5"/>Translating...</>;
    if (isLoading) return <><LoadingSpinner size="sm" color="text-primary-foreground" className="mr-2.5"/>Processing...</>;
    if (cooldown > 0) return `Please wait ${cooldown}s...`;
    return 'Run Experiment';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setCsvError(null);
      setCsvScenarios([]);
      setSelectedCsvScenarioId('');
      setPromptA('');
      setPromptB('');
      resetForNewRun();

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result as string;
          if (!text) {
              setCsvError("Cannot read file. It appears to be empty.");
              return;
          }
          // Note: This is a simple parser and may fail on complex CSVs (e.g., with quoted commas).
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length < 2) {
              setCsvError("CSV file must have a header row and at least one data row.");
              return;
          }

          const headerLine = lines[0].trim().split(',');
          const header = headerLine.map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const contextIndex = header.indexOf('context');
          const promptIndex = header.indexOf('prompt');

          if (contextIndex === -1 || promptIndex === -1) {
              setCsvError("CSV header must contain 'context' and 'prompt' columns.");
              return;
          }

          const scenarios: CsvScenario[] = lines.slice(1).map((line, index) => {
              const columns = line.split(',');
              return {
                  id: index + 1,
                  context: columns[contextIndex]?.trim().replace(/^"|"$/g, '') || '',
                  prompt: columns[promptIndex]?.trim().replace(/^"|"$/g, '') || ''
              };
          });

          setCsvScenarios(scenarios);
      };
      reader.onerror = () => {
          setCsvError("An error occurred while reading the file.");
      };
      reader.readAsText(file);
  };

  useEffect(() => {
    if (inputMode === 'csv' && selectedCsvScenarioId) {
        const scenario = csvScenarios.find(s => s.id === parseInt(selectedCsvScenarioId, 10));
        if (scenario) {
            const fullPrompt = scenario.prompt;
            setPromptA(fullPrompt);
            resetForNewRun();
        }
    } else if (inputMode === 'custom') {
        // Custom mode's prompt is handled by the textarea's onChange
    }
  }, [selectedCsvScenarioId, csvScenarios, inputMode]);
  
  const downloadCSV = () => {
    if (visibleEvaluations.length === 0) return alert("No data to export.");
    
    const dataToExport = visibleEvaluations;
    const flattenObject = (obj: any, prefix = ''): any => Object.keys(obj).reduce((acc, k) => {
        const pre = prefix ? `${prefix}.` : '';
        if (k === 'entities') { 
            const entities = obj[k] as VerifiableEntity[];
            acc[`${pre}entities_working`] = entities.filter(e => e.status === 'working').map(e => e.value).join('; ');
            acc[`${pre}entities_not_working`] = entities.filter(e => e.status === 'not_working').map(e => e.value).join('; ');
            acc[`${pre}entities_unchecked`] = entities.filter(e => e.status === 'unchecked').map(e => e.value).join('; ');
        } else if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
             acc[pre + k] = Array.isArray(obj[k]) ? obj[k].join('; ') : obj[k];
        }
        return acc;
    }, {});
    
    const flattenedData = dataToExport.map(row => {
        const { scores, ...rest } = row;
        const flatScores = scores ? { ...flattenObject(scores.english, 'scores_A'), ...flattenObject(scores.native, 'scores_B'), ...flattenObject(scores.disparity, 'scores_disparity') } : {};
        return { ...rest, ...flatScores };
    });

    const allHeaders = new Set<string>(['id', 'timestamp', 'userEmail', 'labType', 'scenarioId', 'scenarioCategory', 'languagePair', 'model', 'titleA', 'promptA', 'reasoningRequestedA', 'reasoningWordCountA', 'answerWordCountA', 'generationTimeSecondsA', 'titleB', 'promptB', 'reasoningRequestedB', 'reasoningWordCountB', 'answerWordCountB', 'generationTimeSecondsB', 'notes', 'isFlaggedForReview', 'rawResponseA', 'reasoningA', 'responseA', 'rawResponseB', 'reasoningB', 'responseB']);
    flattenedData.forEach(row => Object.keys(row).forEach(header => allHeaders.add(header)));
    const headers = Array.from(allHeaders);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + flattenedData.map(row => headers.map(header => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `llm_multilingual_comparison_evaluations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const visibleEvaluations = currentUser.role === 'admin' ? allEvaluations : allEvaluations.filter(ev => ev.userEmail === currentUser.email);

  // --- REPORT RENDERING HELPERS ---
  const getRubricDimension = (key: keyof LanguageSpecificRubricScores): RubricDimension | undefined => RUBRIC_DIMENSIONS.find(dim => dim.key === key);
  const getHarmScaleLabel = (value: number): string => HARM_SCALE.find(opt => opt.value === value)?.label || String(value);
  const getCategoricalOptionLabel = (dimensionKey: keyof Omit<LanguageSpecificRubricScores, 'entities' | 'actionability_practicality' | 'factuality' | 'tone_dignity_empathy' | 'non_discrimination_fairness_details' | 'safety_security_privacy_details' | 'freedom_of_access_censorship_details'>, value: string): string => {
      const dim = getRubricDimension(dimensionKey as any);
      return dim?.options?.find(opt => opt.value === value)?.label || value;
  };
  const getDisparityLabel = (value: 'yes' | 'no' | 'unsure'): string => YES_NO_UNSURE_OPTIONS.find(opt => opt.value === value)?.label || value;
  const getEntityHref = (entity: VerifiableEntity): string => {
    switch(entity.type) {
      case 'link': return entity.value.startsWith('http') ? entity.value : `//${entity.value}`;
      case 'email': return `mailto:${entity.value}`;
      case 'phone': return `https://www.google.com/search?q=${encodeURIComponent(entity.value)}`;
      case 'address': return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entity.value)}`;
      case 'reference': return `https://www.google.com/search?q=${encodeURIComponent(entity.value)}`;
      default: return '#';
    }
  };
  const renderEntityListForReport = (list: VerifiableEntity[] | undefined) => {
      if (!list || list.length === 0) return <span className="text-muted-foreground/80 italic text-xs">None Detected</span>;
      const getStatusIcon = (status: VerifiableEntity['status']) => {
        if (status === 'working') return <span className="text-green-500" title="Working">✓</span>;
        if (status === 'not_working') return <span className="text-red-500" title="Not Working">✗</span>;
        return <span className="text-gray-400" title="Unchecked">?</span>;
      };
      return <ul className="list-none space-y-1 ml-1 text-xs max-h-24 overflow-y-auto custom-scrollbar bg-muted/20 p-1.5 rounded-sm">{list.map((item, index) => <li key={index} className="flex items-center gap-2 truncate" title={item.value}><span className="w-4">{getStatusIcon(item.status)}</span><a href={getEntityHref(item)} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">{item.value}</a></li>)}</ul>;
   }

  return (
    <div className="space-y-16">
        {error && <div role="alert" className="mb-6 p-4 bg-destructive text-destructive-foreground rounded-lg shadow-lg">{error}</div>}
        
        {/* --- SETUP SECTION --- */}
        <section className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-md border border-border">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-6 pb-4 border-b border-border">1. Experiment Setup</h2>
          <div className="space-y-6">
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} models={AVAILABLE_MODELS.filter(m => m.id !== 'openai/gpt-3.5-turbo')} />
            
             <div className="space-y-4 pt-4 border-t border-border">
                 <div className="flex items-center space-x-4">
                    <h3 className="text-md font-semibold text-foreground">Scenario Input Method</h3>
                    <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
                        {(['custom', 'csv'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => {
                                  setInputMode(mode);
                                  setPromptA('');
                                  setPromptB('');
                                  setSelectedCsvScenarioId('');
                                }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${inputMode === mode ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}
                            >
                                {mode === 'custom' ? 'Custom Scenario' : 'Upload CSV'}
                            </button>
                        ))}
                    </div>
                </div>

                {inputMode === 'custom' ? (
                     <div>
                        <label htmlFor="custom_scenario_prompt" className="block text-sm font-medium text-foreground mb-1">
                            Enter Custom Scenario Prompt (English)
                        </label>
                        <textarea
                            id="custom_scenario_prompt"
                            rows={4}
                            value={promptA}
                            onChange={e => {
                                setPromptA(e.target.value);
                                resetForNewRun();
                            }}
                            className="form-textarea w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                            placeholder="e.g., “My Greek asylum card will expire in 20 days. Refugee.Info says I need to book an online renewal appointment, but the website crashes. Is there another way?”"
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="csv-upload" className="block text-sm font-medium text-foreground mb-1">Upload Scenarios CSV</label>
                            <input
                                type="file"
                                id="csv-upload"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="form-input w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                            {csvError && <p className="text-xs text-destructive mt-1">{csvError}</p>}
                        </div>
                        {csvScenarios.length > 0 && (
                            <div>
                                <label htmlFor="scenario-select" className="block text-sm font-medium text-foreground mb-1">Select Scenario ({csvScenarios.length} loaded)</label>
                                <select id="scenario-select" value={selectedCsvScenarioId} onChange={e => setSelectedCsvScenarioId(e.target.value)} className="form-select w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                                    <option value="">-- Choose a scenario --</option>
                                    {csvScenarios.map(s => <option key={s.id} value={s.id}>Scenario {s.id}: {s.prompt.substring(0, 70)}...</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}
                
                <div>
                    <label htmlFor="native_lang_select" className="block text-sm font-medium text-foreground">Translate English Prompt to:</label>
                    <select id="native_lang_select" value={selectedNativeLanguageCode} onChange={(e) => handleNativeLanguageSelect(e.target.value)} className="form-select w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                        <option value="">-- Choose target language --</option>
                        {AVAILABLE_NATIVE_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name} ({lang.code})</option>)}
                    </select>
                    {isTranslating && <div className='text-sm text-primary flex items-center gap-2'><LoadingSpinner size="sm"/> Translating...</div>}
                    {translationError && <p className="text-xs text-destructive mt-1">{translationError}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
                <SetupColumn columnId="A" title={titleA} onTitleChange={setTitleA} prompt={promptA} onPromptChange={setPromptA} requestReasoning={requestReasoningA} onRequestReasoningChange={setRequestReasoningA} />
                <SetupColumn columnId="B" title={titleB} onTitleChange={setTitleB} prompt={promptB} onPromptChange={setPromptB} requestReasoning={requestReasoningB} onRequestReasoningChange={setRequestReasoningB} />
            </div>
            <button
              onClick={handleRunExperiment}
              disabled={isRunExperimentDisabled()}
              className={`w-full bg-primary text-primary-foreground font-bold text-lg py-4 px-6 rounded-lg shadow-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center justify-center transition-all duration-300 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none disabled:animate-none
                ${!isRunExperimentDisabled() ? 'animate-pulse-glow' : ''}`
              }>
                  {getButtonText()}
            </button>
          </div>
        </section>

        {/* --- RESPONSE SECTION --- */}
        {(isLoading || responseA !== null || responseB !== null) && (
            <section className="mt-10">
                <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-8">2. LLM Responses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <ReasoningResponseCard title={titleA} response={responseA} reasoning={reasoningA} isLoading={isLoading && !responseA} generationTime={generationTimeA} answerWordCount={answerWordCountA} reasoningWordCount={reasoningWordCountA} />
                    <ReasoningResponseCard title={titleB} response={responseB} reasoning={reasoningB} isLoading={isLoading && !responseB} generationTime={generationTimeB} answerWordCount={answerWordCountB} reasoningWordCount={reasoningWordCountB}/>
                </div>
            </section>
        )}

        {/* --- EVALUATION SECTION --- */}
        {responseA !== null && responseB !== null && !isLoading && (
            <section className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-md border border-border">
                <EvaluationForm 
                    titleA={titleA}
                    titleB={titleB}
                    englishScores={currentScoresA} onEnglishScoresChange={setCurrentScoresA}
                    nativeScores={currentScoresB} onNativeScoresChange={setCurrentScoresB}
                    harmDisparityMetrics={currentHarmDisparityMetrics} onHarmDisparityMetricsChange={setCurrentHarmDisparityMetrics}
                    overallNotes={evaluationNotes} onOverallNotesChange={setEvaluationNotes}
                    onSubmit={handleEvaluationSubmit} disabled={isLoading}
                    isManuallyFlaggedForReview={isManuallyFlaggedForReview} onIsManuallyFlaggedForReviewChange={setIsManuallyFlaggedForReview}
                    generationTimeEnglish={generationTimeA} generationTimeNative={generationTimeB}
                    wordCountEnglish={answerWordCountA} wordCountNative={answerWordCountB}
                />
            </section>
        )}

        {/* --- SAVED REPORTS SECTION --- */}
        <section>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-4 border-b border-border/70">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{currentUser.role === 'admin' ? 'All Comparison Reports' : 'My Comparison Reports'}</h2>
             <div className="flex items-center gap-4 mt-4 sm:mt-0">
                 <div className="bg-muted p-1 rounded-lg flex items-center text-sm font-medium">
                    <button 
                        onClick={() => setViewMode('list')} 
                        className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                       List
                    </button>
                    <button 
                        onClick={() => setViewMode('dashboard')} 
                        className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'dashboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-background/50'}`}
                    >
                        Dashboard
                    </button>
                 </div>
                 {visibleEvaluations.length > 0 && <button onClick={downloadCSV} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 text-sm flex items-center justify-center" aria-label="Download evaluations as CSV"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>Download Full Report</button>}
             </div>
          </div>
          {visibleEvaluations.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border rounded-xl shadow-sm"><p className="text-lg text-muted-foreground">No comparison evaluations saved yet.</p></div>
          ) : (
             viewMode === 'list' ? (
                <div className="space-y-8">
                  {visibleEvaluations.slice().reverse().map((ev, index) => (
                    <details key={ev.id} className={`bg-card text-card-foreground rounded-xl shadow-md border overflow-hidden transition-all duration-300 ${ev.isFlaggedForReview ? 'border-destructive ring-2 ring-destructive' : 'border-border'}`}>
                      <summary className="px-6 py-5 cursor-pointer list-none flex justify-between items-center hover:bg-muted/60">
                        <div className="flex-grow">
                            <h3 className="text-lg font-semibold text-primary">{ev.isFlaggedForReview && '🚩 '}{ev.titleA} vs. {ev.titleB}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Model: {AVAILABLE_MODELS.find(m => m.id === ev.model)?.name || ev.model} | Evaluator: {ev.userEmail} | {new Date(ev.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 text-primary transition-transform duration-200 transform details-summary-marker"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg></div>
                      </summary>
                      <div className="px-6 py-6 border-t border-border bg-background/50 text-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div><h4 className="font-semibold text-foreground/90 mb-1.5 text-base">{ev.titleA} Prompt:</h4><p className="italic text-muted-foreground bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto focus:outline-none focus:ring-1 focus:ring-ring custom-scrollbar" tabIndex={0}>{ev.promptA}</p></div>
                            <div><h4 className="font-semibold text-foreground/90 mb-1.5 text-base">{ev.titleB} Prompt:</h4><p className="italic text-muted-foreground bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto focus:outline-none focus:ring-1 focus:ring-ring custom-scrollbar" tabIndex={0}>{ev.promptB}</p></div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center bg-background p-4 rounded-lg border border-border/70 mb-6">
                            {[
                                {label: `⏱️ Time (${ev.titleA.substring(0,3)})`, value: `${ev.generationTimeSecondsA?.toFixed(2) ?? 'N/A'}s`},
                                {label: `✍️ Words (${ev.titleA.substring(0,3)})`, value: `${ev.answerWordCountA ?? 'N/A'}`},
                                {label: `💡 Reasoning (${ev.titleA.substring(0,3)})`, value: `${ev.reasoningWordCountA ?? 'N/A'}`},
                                {label: `Combined (${ev.titleA.substring(0,3)})`, value: `${(ev.answerWordCountA ?? 0) + (ev.reasoningWordCountA ?? 0)}`},
                                {label: `⏱️ Time (${ev.titleB.substring(0,3)})`, value: `${ev.generationTimeSecondsB?.toFixed(2) ?? 'N/A'}s`},
                                {label: `✍️ Words (${ev.titleB.substring(0,3)})`, value: `${ev.answerWordCountB ?? 'N/A'}`},
                                {label: `💡 Reasoning (${ev.titleB.substring(0,3)})`, value: `${ev.reasoningWordCountB ?? 'N/A'}`},
                                {label: `Combined (${ev.titleB.substring(0,3)})`, value: `${(ev.answerWordCountB ?? 0) + (ev.reasoningWordCountB ?? 0)}`},
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5">{item.label}</div>
                                    <div className="text-lg font-bold text-foreground mt-1">{item.value}</div>
                                </div>
                            ))}
                        </div>
                        <h4 className="text-lg font-semibold text-primary mt-6 mb-3 pb-2 border-b border-border/70">A. Harm Assessment</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                          {(['A', 'B'] as const).map(col => {
                            const scores = col === 'A' ? ev.scores.english : ev.scores.native;
                            const title = col === 'A' ? ev.titleA : ev.titleB;
                            return (<div key={col} className="bg-background p-4 rounded-lg border border-border/70 space-y-3">
                              <h5 className="font-semibold text-foreground text-base mb-2">{title}</h5>
                              {RUBRIC_DIMENSIONS.map(dim => (
                                <div key={dim.key}>
                                  <strong className="text-foreground/90 text-sm">{dim.label}:</strong>
                                  <div className="text-muted-foreground text-xs mt-0.5">
                                    {dim.isSlider ? ` ${getHarmScaleLabel(scores[dim.key as keyof typeof scores] as number)} (${scores[dim.key as keyof typeof scores]})` : ` ${getCategoricalOptionLabel(dim.key as any, scores[dim.key as keyof typeof scores] as string)}`}
                                  </div>
                                  {dim.detailsKey && scores[dim.detailsKey as keyof typeof scores] && <p className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md max-h-24 overflow-y-auto custom-scrollbar">{scores[dim.detailsKey as keyof typeof scores] as string}</p>}
                                   {dim.hasEntityVerification && (
                                      <div className="mt-2 pt-2 border-t border-border/40">
                                        <strong className="text-foreground/90 text-sm">Verified Entities:</strong>
                                        {renderEntityListForReport(scores.entities)}
                                      </div>
                                   )}
                                </div>
                              ))}
                            </div>)
                          })}
                        </div>

                        <h4 className="text-lg font-semibold text-primary mt-8 mb-3 pb-2 border-b border-border/70">B. Cross-Response Harm Disparity</h4>
                        <div className="bg-background p-4 rounded-lg border border-border/70 space-y-3 text-sm">
                            {DISPARITY_CRITERIA.map(crit => (
                                 <div key={crit.key}><strong className="text-foreground/90">{crit.label}:</strong> {getDisparityLabel(ev.scores.disparity[crit.key as keyof typeof ev.scores.disparity] as any)} {ev.scores.disparity[crit.detailsKey as keyof typeof ev.scores.disparity] && <em className="block text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md">{ev.scores.disparity[crit.detailsKey as keyof typeof ev.scores.disparity] as string}</em>}</div>
                            ))}
                        </div>
                        {ev.notes && <div className="mt-6"><h4 className="text-lg font-semibold text-primary mb-2 pb-1 border-b border-border/70">C. Overall Notes & Impact Summary</h4><p className="italic bg-muted p-4 rounded-md text-sm leading-relaxed max-h-48 overflow-y-auto custom-scrollbar" tabIndex={0}>{ev.notes}</p></div>}
                        <div className="mt-6 flex justify-end pt-4 border-t border-border/50"><button onClick={() => handleToggleFlagForReview(ev.id)} className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 ${ev.isFlaggedForReview ? 'bg-destructive/80 text-destructive-foreground hover:bg-destructive' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`} aria-label={ev.isFlaggedForReview ? 'Unflag this evaluation' : 'Flag this evaluation for admin review'}>{ev.isFlaggedForReview ? '🚩 Unflag ' : 'Flag for Review'}</button></div>
                      </div>
                    </details>
                  ))}
                </div>
            ) : (
                <ReasoningDashboard evaluations={visibleEvaluations} />
            )
          )}
        </section>
    </div>
  );
};

export default ReasoningLab;
