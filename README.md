# Multilingual LLM Mini-Lab

**This application now has a two-level access system. See Section 2 for login details.**

## 1. Goals of the Application

The Multilingual LLM Mini-Lab is a web-based platform for workshop participants to:

*   **Evaluate Multiple LLMs:** Test models from Google (Gemini), OpenAI (GPT), and Mistral on their performance with multilingual content relevant to refugee, asylum seeker, and displaced person scenarios. The evaluation explicitly uses a **human rights-based approach**.
*   **Auto-Translate & Compare:**
    *   Upload scenarios from a CSV file or create custom prompts. A sample CSV should contain `category` and `prompt_en` headers.
    *   Choose a target native language.
    *   Utilize bi-directional auto-translation for custom prompts.
    *   Generate responses for both English and native language prompts using the selected LLM.
*   **Human-Rights Aware Evaluation (UN B-Tech Aligned):**
    *   **A. Harm Assessment (Single Response):** Assess each language's response against a rubric derived from the UN B-Tech GenAI taxonomy of harm. Criteria include: `Access to Information & Essential Services`, `Non-Discrimination & Fairness`, `Safety, Security & Dignity`, `Freedom of Expression & Privacy`, and `Access to Remedy`.
    *   **B. Harm Disparity Assessment (Cross-Language):** Evaluate disparities between English and native language responses to identify if the level of risk or protection is unequal across languages.
*   **Detailed Response Analysis:** Automatically extract and display Links, Email Addresses, Phone Numbers, and Physical Addresses from LLM responses to aid in the "Access to Remedy" evaluation.
*   **Data Collection & Reporting:** Save detailed evaluations locally, associated with the logged-in user. Admins can view all evaluations, while Evaluators can only view their own. Download evaluation reports as a CSV file.
*   **Raise Awareness:** Highlight potential harmful outcomes from language and moderation inconsistencies, viewed through a human rights lens.

## 2. Access Control & Login

The application features a two-level access system:

*   **Admin Access:**
    *   **Username:** `rpakzad@taraazresearch.org`
    *   **Password:** `AdminLevel@taraaz`
    *   **Permissions:** Admins can view all evaluations submitted by all users and download a complete CSV of all data.

*   **Evaluator Access:**
    *   **Username:** Your email address (e.g., `user@example.com`)
    *   **Password:** Your email address (the same as your username)
    *   **Permissions:** Evaluators can conduct experiments, submit evaluations, view only their own past evaluations, and download a CSV of their own data.

## 3. API Key Configuration (Crucial!)

This application requires API keys for Google Gemini, OpenAI, and Mistral models to function fully.

**For Local Development (Recommended):**

1.  **Create `env.js` file:** In the root directory of the project, create a file named `env.js`.
2.  **Add your API keys to `env.js`:**
    ```javascript
    // IMPORTANT: DO NOT COMMIT THIS FILE TO VERSION CONTROL IF IT CONTAINS REAL API KEYS!
    // This file is for local development configuration only.

    // For Google Gemini
    export const API_KEY = "YOUR_GOOGLE_GEMINI_API_KEY_HERE";
    
    // For OpenAI
    export const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";

    // For Mistral
    export const MISTRAL_API_KEY = "YOUR_MISTRAL_API_KEY_HERE";
    ```
    Replace the placeholder strings with your actual API keys.
3.  **Security:**
    *   **DO NOT COMMIT `env.js`** to Git or any version control system.
    *   Add `env.js` to your `.gitignore` file: `echo "env.js" >> .gitignore`

The application will read keys from `env.js` and display a prominent warning if any are missing or are still placeholders.

## 4. Codebase Philosophy & Best Practices

This project is structured for modularity and maintainability. Key principles for developers include:

*   **Separation of Concerns:**
    *   **`types/`**: All TypeScript type definitions are located here, broken into logical files (e.g., `evaluation.ts`, `models.ts`).
    *   **`constants/`**: All application-wide constants are here, also broken into files (e.g., `api.ts`, `rubric.ts`).
    *   **`components/`**: Contains all reusable React components.
    *   **`services/`**: Houses logic that interacts with external APIs (`llmService.ts`) or performs self-contained business logic (`textAnalysisService.ts`).
*   **Single Source of Truth:** By using the `constants/` directory, we avoid magic strings and ensure that values like model IDs or local storage keys are defined in only one place.
*   **Clean Imports:** The `index.ts` file in both `types/` and `constants/` allows for clean, simple imports (e.g., `import { User } from './types';`).
*   **Clear Commenting:** Add concise, professional comments to explain the *why* behind complex code, not just the *what*.

## 5. Future Roadmap

A detailed plan for future features and architectural improvements is maintained in `featureroadmap.md`. This includes a multi-phase plan and a guide for developers. We encourage all contributors to review it.

## 6. File System Overview

```
multilingual-mini-lab/
├── components/         # React components
├── constants/          # App constants (models, rubric, etc.)
├── services/           # API clients and business logic
├── types/              # TypeScript type definitions
├── public/
│   └── scenarios.json  # Sample scenario file, not loaded by default
├── App.tsx             # Main application component
├── env.js              # Local API Key Config (gitignore this!)
├── index.html
├── index.tsx
├── README.md           # This file
├── featureroadmap.md   # NEW: Future plans and dev guide
└── llmtaskscompleted.md # Log of completed work
```