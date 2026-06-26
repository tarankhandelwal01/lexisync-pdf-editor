import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface UploadScreenProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  error: string | null;
}

export function UploadScreen({ onFileSelect, loading, error }: UploadScreenProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const triggerInputClick = () => {
    fileInputRef.current?.click();
  };

  // Helper to generate a blank page PDF to quickstart editing
  const loadQuickstartSample = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      // Add standard letter page (612x792 points)
      pdfDoc.addPage([612, 792]);
      const pdfBytes = await pdfDoc.save();
      
      const file = new File([pdfBytes], 'Blank_Draft.pdf', { type: 'application/pdf' });
      onFileSelect(file);
    } catch (err) {
      console.error('Failed to generate quickstart PDF:', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-slate-50">
      <div className="w-full max-w-xl p-8 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
        
        {/* Title & icon */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Upload PDF Document
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Add overlays, signatures, text edits, and annotations fully in your browser.
          </p>
        </div>

        {/* Drop zone container */}
        <div
          id="drop-zone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerInputClick}
          className={`relative w-full aspect-[4/3] flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner'
              : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleChange}
          />

          {loading ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <p className="text-sm font-medium text-slate-600">
                Opening PDF document safely...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center p-6">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Drag and drop your file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                or click to browse from system files
              </p>
              <div className="mt-4 px-3 py-1 bg-slate-100 text-[11px] text-slate-500 rounded-full font-medium">
                Supports standard .pdf up to 100MB
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Fast Playground Quickstart option */}
        {!loading && (
          <div className="w-full border-t border-slate-100 mt-6 pt-6 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-3 font-medium">
              Want to try it out immediately?
            </p>
            <button
              onClick={loadQuickstartSample}
              id="btn-sample-quickstart"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Quickstart with a Blank Canvas
            </button>
          </div>
        )}

        {/* Information Callout */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
            🔒 <strong>100% Secure & Client-Side:</strong> Your privacy is fully guaranteed. No files ever leave your system, nor get processed or saved on a backend.
          </p>
        </div>

      </div>
    </div>
  );
}
