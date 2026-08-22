declare module 'pdf-parse' {
  const pdfParse: (data: Buffer) => Promise<{ text?: string; numpages?: number; info?: Record<string, unknown> }>;
  export default pdfParse;
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (data: Buffer) => Promise<{ text?: string; numpages?: number; info?: Record<string, unknown> }>;
  export default pdfParse;
}
