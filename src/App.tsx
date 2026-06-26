import { usePDFLoader } from './hooks/usePDFLoader';
import { UploadScreen } from './components/UploadScreen';
import { PDFViewer } from './components/PDFViewer';

export default function App() {
  const {
    loading,
    error,
    pdfDoc,
    pdfMeta,
    loadPDF,
    clearPDF,
  } = usePDFLoader();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      
      {/* State routing selector */}
      {pdfDoc && pdfMeta ? (
        <PDFViewer
          pdfDoc={pdfDoc}
          pdfMeta={pdfMeta}
          onClearPDF={clearPDF}
          onUploadNewFile={loadPDF}
        />
      ) : (
        <UploadScreen
          onFileSelect={loadPDF}
          loading={loading}
          error={error}
        />
      )}

    </div>
  );
}
