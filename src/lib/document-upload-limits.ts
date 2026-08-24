/** Vercel Functions allow 4.5 MB request bodies; leave margin for headers and multipart/request metadata. */
export const MAX_DIRECT_GEMINI_FILE_UPLOAD_BYTES = 4_000_000;
