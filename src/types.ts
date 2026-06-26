export type EditTool = 'select' | 'text' | 'draw' | 'rect' | 'highlight' | 'eraser' | 'edit_pdf_text';

export interface TextOptions {
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
}

export interface HighlightOptions {
  color: string;
  opacity: number;
  width: number;
}

export interface ActiveSettings {
  tool: EditTool;
  color: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  rectFill: string; // 'transparent', 'color' (matching color), etc. Or black for redaction
  redact: boolean; // redaction mode
}

export interface PDFFileState {
  bytes: Uint8Array;
  name: string;
  numPages: number;
  pages: { width: number; height: number }[];
}
