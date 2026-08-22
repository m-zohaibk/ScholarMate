// Match the Google Genkit plugin's lookup order. Prefer one variable in deployment to avoid shadowing.
const GOOGLE_AI_ENV_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'] as const;

export function getGoogleAiConfigurationError() {
  const configuredKey = GOOGLE_AI_ENV_NAMES.map((name) => process.env[name]?.trim()).find(Boolean);
  if (!configuredKey) {
    return 'Google AI is not configured. Add a valid Google AI Studio API key as GOOGLE_GENAI_API_KEY in the Vercel Production environment, then redeploy.';
  }
  if (/^(AQ\.|ya29\.|eyJ|1\/)/.test(configuredKey)) {
    return 'Google AI is configured with an OAuth/session token, not an AI Studio API key. Replace it with a Google AI Studio API key in GOOGLE_GENAI_API_KEY and redeploy.';
  }
  return null;
}
