import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { loadPDFDocument } from '../utils/pdfRenderer';
import { PDFFileState } from '../types';

export function usePDFLoader() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfMeta, setPdfMeta] = useState<PDFFileState | null>(null);

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Clone bytes so the PDF.js worker does not detach or empty the ArrayBuffer we need for exporting
      const bytesForPDFJS = new Uint8Array(arrayBuffer);
      const bytes = bytesForPDFJS.slice();
      
      const doc = await loadPDFDocument(bytesForPDFJS);
      setPdfDoc(doc);
      
      const numPages = doc.numPages;
      const pagesMeta: { width: number; height: number }[] = [];
      
      // Get logical width/height of each page
      for (let i = 0; i < numPages; i++) {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1.0 });
        pagesMeta.push({
          width: viewport.width,
          height: viewport.height,
        });
      }
      
      setPdfMeta({
        bytes,
        name: file.name,
        numPages,
        pages: pagesMeta,
      });
      
    } catch (err: any) {
      console.error('Error loading PDF file:', err);
      setError(err?.message || 'Failed to load PDF file. Please verify it is a valid, unencrypted PDF.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPDF = useCallback(() => {
    setPdfDoc(null);
    setPdfMeta(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    pdfDoc,
    pdfMeta,
    loadPDF,
    clearPDF,
  };
}
