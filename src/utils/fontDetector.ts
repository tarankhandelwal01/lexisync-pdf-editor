/**
 * fontDetector.ts
 *
 * PURPOSE: Extract the actual font used in a PDF page and load it
 * so when user edits text, it uses the SAME font as the original PDF.
 *
 * HOW IT WORKS:
 * 1. pdfjs gives us fontName per text item e.g. "ABCDEF+TimesNewRoman-Bold"
 * 2. We clean the name → "Times New Roman" + weight: bold
 * 3. We check if the font is available as a Google Font
 * 4. If yes → inject a <link> to load it from Google Fonts
 * 5. If no → fallback to closest system font
 * 6. We return the final usable CSS fontFamily string
 */

import * as pdfjsLib from 'pdfjs-dist';

export interface DetectedFont {
  fontFamily: string;       // CSS font-family to use in fabric.js
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  originalName: string;     // raw name from pdfjs for debugging
  source: 'google' | 'system' | 'fallback';
}

// ── Google Fonts we can load dynamically ─────────────────────────────────────
// Maps cleaned font name keywords → Google Font API name
const GOOGLE_FONT_MAP: Record<string, string> = {
  'roboto':           'Roboto',
  'opensans':         'Open+Sans',
  'open sans':        'Open+Sans',
  'lato':             'Lato',
  'montserrat':       'Montserrat',
  'raleway':          'Raleway',
  'poppins':          'Poppins',
  'nunito':           'Nunito',
  'sourcesans':       'Source+Sans+3',
  'source sans':      'Source+Sans+3',
  'ubunotu':          'Ubuntu',
  'ubuntu':           'Ubuntu',
  'noto':             'Noto+Sans',
  'playfair':         'Playfair+Display',
  'merriweather':     'Merriweather',
  'ptserif':          'PT+Serif',
  'pt serif':         'PT+Serif',
  'ptsans':           'PT+Sans',
  'pt sans':          'PT+Sans',
  'josefin':          'Josefin+Sans',
  'oswald':           'Oswald',
  'tahoma':           'Tahoma',
  'calibri':          'Carlito',   // Calibri clone available on Google Fonts
  'cambria':          'Caladea',   // Cambria clone available on Google Fonts
  'garamond':         'EB+Garamond',
  'eb garamond':      'EB+Garamond',
  'libre baskerville':'Libre+Baskerville',
  'librebaskerville': 'Libre+Baskerville',
  'crimson':          'Crimson+Text',
  'inter':            'Inter',
  'worksans':         'Work+Sans',
  'work sans':        'Work+Sans',
  'spacegrotesk':     'Space+Grotesk',
  'space grotesk':    'Space+Grotesk',
  'dmserif':          'DM+Serif+Display',
  'dmsans':           'DM+Sans',
  'dm sans':          'DM+Sans',
  'firasans':         'Fira+Sans',
  'fira sans':        'Fira+Sans',
  'inconsolata':      'Inconsolata',
  'jetbrains':        'JetBrains+Mono',
};

// ── System / built-in font mappings ──────────────────────────────────────────
// These don't need loading — they exist in every OS or browser
const SYSTEM_FONT_MAP: Record<string, string> = {
  'helvetica':        'Helvetica, Arial, sans-serif',
  'arial':            'Arial, Helvetica, sans-serif',
  'times':            'Times New Roman, Times, serif',
  'timesnewroman':    'Times New Roman, Times, serif',
  'courier':          'Courier New, Courier, monospace',
  'couriernew':       'Courier New, Courier, monospace',
  'georgia':          'Georgia, serif',
  'verdana':          'Verdana, Geneva, sans-serif',
  'trebuchet':        'Trebuchet MS, sans-serif',
  'impact':           'Impact, Charcoal, sans-serif',
  'palatino':         'Palatino Linotype, Book Antiqua, Palatino, serif',
  'bookantiqua':      'Book Antiqua, Palatino, serif',
  'century':          'Century Gothic, sans-serif',
  'centurygothic':    'Century Gothic, sans-serif',
  'franklingothic':   'Franklin Gothic Medium, Arial Narrow, Arial, sans-serif',
  'lucida':           'Lucida Sans Unicode, Lucida Grande, sans-serif',
  'gillsans':         'Gill Sans, Gill Sans MT, Calibri, sans-serif',
  'futura':           'Futura, Century Gothic, sans-serif',
};

// Cache so we don't load the same font twice
const loadedFonts = new Set<string>();

/**
 * Injects a Google Font <link> tag into the document head.
 * Uses a cache to avoid duplicate requests.
 */
function loadGoogleFont(googleFontName: string, weight: string, style: string): void {
  const cacheKey = `${googleFontName}-${weight}-${style}`;
  if (loadedFonts.has(cacheKey)) return;
  loadedFonts.add(cacheKey);

  const weightNum = weight === 'bold' ? '700' : '400';
  const italicSuffix = style === 'italic' ? 'ital,' : '';
  const url = `https://fonts.googleapis.com/css2?family=${googleFontName}:${italicSuffix}wght@${italicSuffix ? '1,' : ''}${weightNum}&display=swap`;

  // Check if already injected
  if (document.querySelector(`link[href="${url}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Cleans a raw pdfjs font name into a usable lower-case string.
 * pdfjs returns names like: "ABCDEF+TimesNewRoman-BoldItalic"
 * We strip the prefix and normalise to lowercase with spaces.
 */
function cleanFontName(rawName: string): string {
  // Remove 6-char subset prefix like "ABCDEF+"
  let name = rawName.replace(/^[A-Z]{6}\+/, '');
  // Remove common suffixes
  name = name
    .replace(/-(Bold|Italic|BoldItalic|Oblique|Regular|Normal|Medium|Light|Thin|Black|Heavy|SemiBold|Demi)/gi, ' $1')
    .replace(/MT$|PS$|LT$|Pro$|Std$/gi, '')
    .replace(/[_\-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return name;
}

/**
 * Detects bold/italic from the raw font name.
 */
function detectStyle(rawName: string): { fontWeight: 'normal' | 'bold'; fontStyle: 'normal' | 'italic' } {
  const name = rawName.toLowerCase();
  const fontWeight: 'normal' | 'bold' = (
    name.includes('bold') || name.includes('black') || name.includes('heavy') ||
    name.includes('semibold') || name.includes('demi') || name.includes('extrabold')
  ) ? 'bold' : 'normal';

  const fontStyle: 'normal' | 'italic' = (
    name.includes('italic') || name.includes('oblique') || name.includes('ital')
  ) ? 'italic' : 'normal';

  return { fontWeight, fontStyle };
}

interface ComputerModernMatch {
  family: string;
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
}

// Computer Modern / "CM Unicode" style codes used by LaTeX (e.g. cmr10, cmbx12,
// cmti10, cmunbx, cmunsl...). These abbreviations don't contain readable words
// like "bold"/"italic"/"serif", so the keyword-based detection below can never
// match them — they need their own lookup. Ordered most-specific-first.
const CM_STYLE_CODES: Array<{ code: RegExp; weight: 'normal' | 'bold'; style: 'normal' | 'italic'; family: 'serif' | 'sans' | 'mono' }> = [
  { code: /^ssbx/,    weight: 'bold',   style: 'normal', family: 'sans'  }, // sans bold extended
  { code: /^ssi/,     weight: 'normal', style: 'italic', family: 'sans'  }, // sans italic
  { code: /^ss/,      weight: 'normal', style: 'normal', family: 'sans'  }, // sans regular
  { code: /^bx/,      weight: 'bold',   style: 'normal', family: 'serif' }, // bold extended
  { code: /^b(?!x)/,  weight: 'bold',   style: 'normal', family: 'serif' }, // bold
  { code: /^ti/,      weight: 'normal', style: 'italic', family: 'serif' }, // text italic
  { code: /^sl/,      weight: 'normal', style: 'italic', family: 'serif' }, // slanted
  { code: /^(t?csc)/, weight: 'normal', style: 'normal', family: 'serif' }, // caps & small caps
  { code: /^tt/,      weight: 'normal', style: 'normal', family: 'mono'  }, // typewriter
  { code: /^r/,       weight: 'normal', style: 'normal', family: 'serif' }, // roman regular
];

function detectComputerModernFont(rawName: string): ComputerModernMatch | null {
  const stripped = rawName.replace(/^[A-Z0-9]{6}\+/, '');
  const match = stripped.match(/^cm(un)?([a-z]+?)\d*$/i);
  if (!match) return null;

  const codePart = match[2].toLowerCase();
  for (const entry of CM_STYLE_CODES) {
    if (entry.code.test(codePart)) {
      const family =
        entry.family === 'mono'
          ? 'Courier New, monospace'
          : entry.family === 'sans'
            ? 'Helvetica, Arial, sans-serif'
            : 'Georgia, Times New Roman, serif';
      return { family, weight: entry.weight, style: entry.style };
    }
  }
  return null;
}

/**
 * Main function: given a raw pdfjs font name, returns the best matching
 * CSS fontFamily + loads it if needed.
 */
export function detectAndLoadFont(rawFontName: string): DetectedFont {
  const cm = detectComputerModernFont(rawFontName);
  if (cm) {
    return {
      fontFamily: cm.family,
      fontWeight: cm.weight,
      fontStyle: cm.style,
      originalName: rawFontName,
      source: 'system',
    };
  }

  const { fontWeight, fontStyle } = detectStyle(rawFontName);
  const cleaned = cleanFontName(rawFontName);

  // 1. Check Google Fonts map
  for (const [keyword, googleName] of Object.entries(GOOGLE_FONT_MAP)) {
    if (cleaned.includes(keyword)) {
      loadGoogleFont(googleName, fontWeight, fontStyle);
      // Return the CSS name (replace + with space)
      const cssName = googleName.replace(/\+/g, ' ');
      return {
        fontFamily: cssName,
        fontWeight,
        fontStyle,
        originalName: rawFontName,
        source: 'google',
      };
    }
  }

  // 2. Check system fonts map
  for (const [keyword, cssStack] of Object.entries(SYSTEM_FONT_MAP)) {
    if (cleaned.includes(keyword)) {
      return {
        fontFamily: cssStack,
        fontWeight,
        fontStyle,
        originalName: rawFontName,
        source: 'system',
      };
    }
  }

  // 3. Fallback based on category hints
  let fallbackFamily = 'Helvetica, Arial, sans-serif';
  if (cleaned.includes('serif') || cleaned.includes('roman') || cleaned.includes('garamond') ||
      cleaned.includes('book') || cleaned.includes('minion') || cleaned.includes('caslon')) {
    fallbackFamily = 'Georgia, Times New Roman, serif';
  } else if (cleaned.includes('mono') || cleaned.includes('code') || cleaned.includes('type') ||
             cleaned.includes('courier') || cleaned.includes('fixed')) {
    fallbackFamily = 'Courier New, monospace';
  }

  return {
    fontFamily: fallbackFamily,
    fontWeight,
    fontStyle,
    originalName: rawFontName,
    source: 'fallback',
  };
}

/**
 * Like detectAndLoadFont, but takes a `fallbackCategory` ('serif' |
 * 'sans-serif' | 'monospace') computed directly by pdf.js from the PDF's own
 * FontDescriptor flags (via TextContent.styles[fontName].fontFamily) — a
 * synchronous, reliable signal with zero name-guessing involved. It's used
 * as the final fallback instead of always defaulting to Helvetica, so even
 * when the real font name can't be resolved (or doesn't match any known
 * keyword/pattern), at least the serif/sans/mono bucket is always correct.
 */
export function resolveEditFont(realName: string, fallbackCategory?: string): DetectedFont {
  const cm = detectComputerModernFont(realName);
  if (cm) {
    return { fontFamily: cm.family, fontWeight: cm.weight, fontStyle: cm.style, originalName: realName, source: 'system' };
  }

  const { fontWeight, fontStyle } = detectStyle(realName);
  const cleaned = cleanFontName(realName);

  for (const [keyword, googleName] of Object.entries(GOOGLE_FONT_MAP)) {
    if (cleaned.includes(keyword)) {
      loadGoogleFont(googleName, fontWeight, fontStyle);
      return { fontFamily: googleName.replace(/\+/g, ' '), fontWeight, fontStyle, originalName: realName, source: 'google' };
    }
  }

  for (const [keyword, cssStack] of Object.entries(SYSTEM_FONT_MAP)) {
    if (cleaned.includes(keyword)) {
      return { fontFamily: cssStack, fontWeight, fontStyle, originalName: realName, source: 'system' };
    }
  }

  const fallbackFamily =
    fallbackCategory === 'monospace' ? 'Courier New, monospace' :
    fallbackCategory === 'serif' ? 'Georgia, Times New Roman, serif' :
    'Helvetica, Arial, sans-serif';

  return { fontFamily: fallbackFamily, fontWeight, fontStyle, originalName: realName, source: 'fallback' };
}

/**
 * Extracts all unique fonts used on a given PDF page using pdfjs.
 * Returns a map of fontName → DetectedFont so PageCanvas can
 * pre-load all fonts before the user starts editing.
 */
export async function extractPageFonts(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<Map<string, DetectedFont>> {
  const fontMap = new Map<string, DetectedFont>();

  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      const textItem = item as any;
      const fontName: string = textItem.fontName || '';
      if (!fontName || fontMap.has(fontName)) continue;

      const detected = detectAndLoadFont(fontName);
      fontMap.set(fontName, detected);
    }
  } catch (err) {
    console.warn('Font extraction failed for page', pageIndex, err);
  }

  return fontMap;
}

/**
 * Given a pdfjs fontName string, returns the DetectedFont to use
 * when creating fabric IText objects. This is called directly from
 * PageCanvas when the user clicks "Edit Text" on an existing text item.
 */
export function getFontForItem(rawFontName: string): DetectedFont {
  return detectAndLoadFont(rawFontName);
}
