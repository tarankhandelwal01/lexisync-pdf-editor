import { useState, useCallback } from 'react';

const SERVER = 'http://localhost:5001';

export interface ExtractedFont {
  name: string;
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
  cacheKey: string;
  base64: string | null;
  ext: string;
  originalName: string;
  isStandard: boolean;
}

export interface FontExtractionResult {
  fonts: ExtractedFont[];
  pageTextFontMap: Record<number, any[]>;
  totalFonts: number;
  standardCount: number;
  embeddedCount: number;
}

export function useFontExtractor() {
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [result, setResult]                 = useState<FontExtractionResult | null>(null);
  const [fontMap, setFontMap]               = useState<Map<string, ExtractedFont>>(new Map());
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  const checkServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(2000) });
      setServerAvailable(res.ok);
      return res.ok;
    } catch {
      setServerAvailable(false);
      return false;
    }
  }, []);

  const extractFonts = useCallback(async (pdfFile: File): Promise<FontExtractionResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const available = await checkServer();
      if (!available) {
        console.warn('[FontExtractor] Python server not running — using JS fallback');
        setLoading(false);
        return null;
      }

      const formData = new FormData();
      formData.append('file', pdfFile);
      const res = await fetch(`${SERVER}/extract-fonts`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data: FontExtractionResult = await res.json();
      console.log(`[FontExtractor] ${data.standardCount} standard + ${data.embeddedCount} embedded fonts`);

      const newMap = new Map<string, ExtractedFont>();

      for (const font of data.fonts) {
        // Standard fonts: already available in browser, just register the name
        if (font.isStandard || !font.base64) {
          newMap.set(font.originalName.toLowerCase(), font);
          newMap.set(font.name.toLowerCase(), font);
          console.log(`  ✓ Standard font ready: "${font.name}" (${font.weight})`);
          continue;
        }

        // Embedded fonts: load via FontFace API
        try {
          await loadFontInBrowser(font);
          newMap.set(font.originalName.toLowerCase(), font);
          newMap.set(font.name.toLowerCase(), font);
          console.log(`  ✓ Loaded embedded font: "${font.name}"`);
        } catch (e) {
          console.warn(`  ✗ Failed to load "${font.name}":`, e);
          // Still register it so we use the name at least
          newMap.set(font.originalName.toLowerCase(), font);
        }
      }

      setFontMap(newMap);
      setResult(data);
      return data;

    } catch (err: any) {
      setError(err?.message || 'Failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [checkServer]);

  // Called from PageCanvas when user edits a text item.
  // Returns null when there's no real extracted-font match (e.g. the Python
  // server isn't running) so callers can fall back to something better than
  // a hardcoded default.
  const getFontForPdfjsName = useCallback((rawName: string): {
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } | null => {
    if (!rawName || fontMap.size === 0) {
      return null;
    }
    const lower = rawName.toLowerCase();
    // Direct match
    let match = fontMap.get(lower);
    if (!match) {
      // Partial match
      for (const [key, font] of fontMap.entries()) {
        if (lower.includes(key) || key.includes(lower)) {
          match = font; break;
        }
      }
    }
    if (match) {
      return { fontFamily: match.name, fontWeight: match.weight, fontStyle: match.style };
    }
    return null;
  }, [fontMap]);

  return { loading, error, result, fontMap, serverAvailable, extractFonts, getFontForPdfjsName, checkServer };
}

async function loadFontInBrowser(font: ExtractedFont): Promise<void> {
  if (!font.base64) return;
  const binary = atob(font.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const mime = { ttf:'font/ttf', otf:'font/otf', woff:'font/woff', woff2:'font/woff2' }[font.ext.toLowerCase()] || 'font/ttf';
  const face = new FontFace(font.name, bytes.buffer, {
    weight: font.weight === 'bold' ? '700' : '400',
    style: font.style,
  });
  await face.load();
  document.fonts.add(face);
}
