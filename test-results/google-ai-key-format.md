# Google Gemini API key compatibility finding

The official Gemini API documentation retrieved on 2026-08-24 states that the Gemini API supports both standard API keys and authorization (auth) API keys, and that new keys created in Google AI Studio are automatically created as auth keys. The same documentation recommends environment variables for server applications and states that the Gemini API client libraries detect the configured key. The OAuth documentation separately describes OAuth access tokens as a different authentication path.

Implication for ScholarMate: rejecting a configured value solely because its prefix resembles `AQ.Ab` is outdated. The app should let Genkit send the configured value through the native Google Gemini API-key header and report the provider’s actual response. The full credential must never be written to this file, logs, GitHub, or chat.

Sources:
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/gemini-api/docs/oauth
