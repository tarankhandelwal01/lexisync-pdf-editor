import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { exportMergedPDF } from '../utils/overlayExporter';

interface ExportPDFProps {
  originalBytes: Uint8Array | undefined;
  pagesState: Record<number, any>;
  pagesMeta: { width: number; height: number }[] | undefined;
  fileName: string | undefined;
}

export function usePDFExport() {
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const exportPDF = useCallback(async ({
    originalBytes,
    pagesState,
    pagesMeta,
    fileName,
  }: ExportPDFProps, onSuccess?: () => void) => {
    if (!originalBytes || !pagesMeta || !fileName) {
      setError('No PDF data available to export.');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      // Direct call to merge overlays
      const mergedBytes = await exportMergedPDF(originalBytes, pagesState, pagesMeta);
      
      // Save file locally in the client
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const baseName = fileName.endsWith('.pdf') ? fileName.slice(0, -4) : fileName;
      const downloadName = `${baseName}_edited.pdf`;
      
      saveAs(blob, downloadName);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error during PDF export:', err);
      setError(err?.message || 'Failed to draw overlays and compile PDF file.');
    } finally {
      setExporting(false);
    }
  }, []);

  return {
    exporting,
    error,
    exportPDF,
  };
}
