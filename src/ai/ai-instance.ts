
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Check if the API key is available. Log a warning if not.
const apiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey && process.env.NODE_ENV === 'production') {
  // Only log a severe warning in production build if the key is missing.
  // In development, it might be expected to be missing sometimes.
  console.warn(
    'WARNING: GOOGLE_GENAI_API_KEY environment variable is not set. Genkit features requiring Google AI will fail.'
  );
}

export const ai = genkit({
  promptDir: './prompts',
  plugins: apiKey // Only include the plugin if the API key exists
    ? [
        googleAI({
          apiKey: apiKey,
        }),
      ]
    : [], // Pass an empty array if the key is missing
  model: 'googleai/gemini-2.0-flash',
  // Add flowStateStore and traceStore to prevent build errors if no plugins are loaded
  // Ensure these are set to avoid potential Genkit initialization errors if the googleAI plugin is absent.
  flowStateStore: 'memory',
  traceStore: 'memory',
});
