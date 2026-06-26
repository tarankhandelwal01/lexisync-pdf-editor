"""
PDF Font Extraction Server — Fixed Version
==========================================
Handles BOTH cases:
1. Standard fonts (Helvetica, Arial, Times) — NOT embedded in PDF, return name directly
2. Custom embedded fonts — extract bytes and return as base64

Also returns per-span font info for track changes UI.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import fitz  # PyMuPDF
import base64
import io
import re

app = Flask(__name__)
CORS(app)

FONT_CACHE = {}  # cache_key → { bytes, ext, name, weight, style }

# Standard PDF fonts — built into every PDF reader, never embedded
STANDARD_FONTS = {
    'helvetica':          {'family': 'Helvetica',        'weight': 'normal', 'style': 'normal'},
    'helvetica-bold':     {'family': 'Helvetica',        'weight': 'bold',   'style': 'normal'},
    'helvetica-oblique':  {'family': 'Helvetica',        'weight': 'normal', 'style': 'italic'},
    'helvetica-boldoblique': {'family': 'Helvetica',     'weight': 'bold',   'style': 'italic'},
    'times-roman':        {'family': 'Times New Roman',  'weight': 'normal', 'style': 'normal'},
    'times-bold':         {'family': 'Times New Roman',  'weight': 'bold',   'style': 'normal'},
    'times-italic':       {'family': 'Times New Roman',  'weight': 'normal', 'style': 'italic'},
    'times-bolditalic':   {'family': 'Times New Roman',  'weight': 'bold',   'style': 'italic'},
    'courier':            {'family': 'Courier New',      'weight': 'normal', 'style': 'normal'},
    'courier-bold':       {'family': 'Courier New',      'weight': 'bold',   'style': 'normal'},
    'courier-oblique':    {'family': 'Courier New',      'weight': 'normal', 'style': 'italic'},
    'courier-boldoblique':{'family': 'Courier New',      'weight': 'bold',   'style': 'italic'},
    'symbol':             {'family': 'Symbol',           'weight': 'normal', 'style': 'normal'},
    'zapfdingbats':       {'family': 'ZapfDingbats',     'weight': 'normal', 'style': 'normal'},
    'arial':              {'family': 'Arial',            'weight': 'normal', 'style': 'normal'},
    'arial-bold':         {'family': 'Arial',            'weight': 'bold',   'style': 'normal'},
    'arial-italic':       {'family': 'Arial',            'weight': 'normal', 'style': 'italic'},
    'arial-bolditalic':   {'family': 'Arial',            'weight': 'bold',   'style': 'italic'},
    'georgia':            {'family': 'Georgia',          'weight': 'normal', 'style': 'normal'},
    'georgia-bold':       {'family': 'Georgia',          'weight': 'bold',   'style': 'normal'},
    'verdana':            {'family': 'Verdana',          'weight': 'normal', 'style': 'normal'},
    'trebuchet':          {'family': 'Trebuchet MS',     'weight': 'normal', 'style': 'normal'},
    'impact':             {'family': 'Impact',           'weight': 'normal', 'style': 'normal'},
}

def parse_font_name(raw):
    """Parse raw PDF font name → (clean_family, weight, style)"""
    name = raw
    # Remove 6-char subset prefix like "ABCDEF+"
    name = re.sub(r'^[A-Z]{6}\+', '', name)

    weight = 'bold' if any(k in name.lower() for k in [
        'bold','black','heavy','semibold','demi','extrabold','ultrabold','medium'
    ]) else 'normal'

    style = 'italic' if any(k in name.lower() for k in [
        'italic','oblique','ital','slant'
    ]) else 'normal'

    # Clean family name — remove weight/style suffixes
    clean = name
    for suffix in [
        '-BoldItalic','-BoldOblique','-Bold','-Italic','-Oblique',
        '-Regular','-Normal','-Medium','-Light','-Thin','-Black',
        '-Heavy','-Semibold','-Demi','-ExtraBold','BoldItalic','Bold',
        'Italic','Regular','Normal','MT','PS','LT','Pro','Std','SC',
    ]:
        clean = clean.replace(suffix, '')

    # Add spaces before capitals: "TimesNewRoman" → "Times New Roman"
    clean = re.sub(r'([A-Z][a-z]+)', r' \1', clean).strip()
    clean = re.sub(r'\s+', ' ', clean).strip()
    if not clean:
        clean = 'Sans Serif'

    return clean, weight, style

def check_standard_font(raw_name):
    """Check if this is a standard PDF font that doesn't need embedding"""
    key = raw_name.lower().replace(' ', '-').replace('_', '-')
    # Remove subset prefix
    key = re.sub(r'^[a-z]{6}\+', '', key)
    return STANDARD_FONTS.get(key)

@app.route('/extract-fonts', methods=['POST'])
def extract_fonts():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400

    pdf_bytes = request.files['file'].read()
    print(f"\n--- Processing PDF Font Extraction ({len(pdf_bytes)} bytes) ---")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    extracted_fonts = {}   # xref/key → font info
    standard_fonts_found = {}  # name → font info (no bytes needed)

    # ── Step 1: Get all fonts across all pages ─────────────────────────────
    seen_xrefs = set()
    for page_num in range(len(doc)):
        page = doc[page_num]
        for font_info in page.get_fonts(full=True):
            xref     = font_info[0]
            fontname = font_info[3] or font_info[4] or 'Unknown'
            basename = font_info[4] or fontname

            # Check standard font first
            std = check_standard_font(basename) or check_standard_font(fontname)
            if std:
                key = f"std_{std['family'].replace(' ','_').lower()}"
                if key not in standard_fonts_found:
                    standard_fonts_found[key] = {
                        'cacheKey': key,
                        'name': std['family'],
                        'weight': std['weight'],
                        'style': std['style'],
                        'originalName': fontname,
                        'isStandard': True,
                        'base64': None,
                        'ext': 'standard',
                    }
                    print(f"  ✓ Standard font: '{fontname}' → '{std['family']}' ({std['weight']})")
                continue

            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            # Try to extract embedded font bytes
            try:
                font_data = doc.extract_font(xref)
                if not font_data or not font_data[3] or len(font_data[3]) == 0:
                    # 0 bytes = standard or unembedded font — handle by name
                    clean, weight, style = parse_font_name(fontname)
                    key = f"std_{clean.replace(' ','_').lower()}"
                    standard_fonts_found[key] = {
                        'cacheKey': key,
                        'name': clean,
                        'weight': weight,
                        'style': style,
                        'originalName': fontname,
                        'isStandard': True,
                        'base64': None,
                        'ext': 'standard',
                    }
                    print(f"  ℹ️ Unembedded font: '{fontname}' → using name '{clean}' ({weight})")
                    continue

                font_bytes = font_data[3]
                font_ext   = (font_data[1] or 'ttf').replace('n/a','ttf')
                clean, weight, style = parse_font_name(fontname)
                cache_key = f"{clean.replace(' ','_').replace('/','_').lower()}_{weight}_{style}"

                FONT_CACHE[cache_key] = {
                    'bytes': font_bytes, 'ext': font_ext,
                    'name': clean, 'weight': weight, 'style': style,
                }
                extracted_fonts[xref] = {
                    'cacheKey': cache_key,
                    'name': clean,
                    'weight': weight,
                    'style': style,
                    'originalName': fontname,
                    'isStandard': False,
                    'base64': base64.b64encode(font_bytes).decode(),
                    'ext': font_ext,
                }
                print(f"  ✓ Embedded font: '{fontname}' → '{clean}' ({weight}, {style}, {len(font_bytes)} bytes)")

            except Exception as e:
                print(f"  ✗ Error on xref={xref}: {e}")

    # ── Step 2: Per-span font map (which text uses which font) ─────────────
    page_text_font_map = {}
    all_font_lookup = {**{v['originalName']: v for v in standard_fonts_found.values()},
                       **{v['originalName']: v for v in extracted_fonts.values()}}

    for page_num in range(len(doc)):
        page = doc[page_num]
        spans = []
        try:
            blocks = page.get_text('rawdict').get('blocks', [])
            for block in blocks:
                if block.get('type') != 0:
                    continue
                for line in block.get('lines', []):
                    for span in line.get('spans', []):
                        txt = span.get('text', '').strip()
                        if not txt:
                            continue
                        sf = span.get('font', '')
                        # Find matching font
                        matched = None
                        for orig_name, finfo in all_font_lookup.items():
                            if sf.lower() in orig_name.lower() or orig_name.lower() in sf.lower():
                                matched = finfo
                                break
                        if not matched:
                            # Detect from name
                            std = check_standard_font(sf)
                            if std:
                                matched = {'name': std['family'], 'weight': std['weight'], 'style': std['style'], 'cacheKey': ''}
                            else:
                                clean, w, s = parse_font_name(sf)
                                matched = {'name': clean, 'weight': w, 'style': s, 'cacheKey': ''}

                        spans.append({
                            'text': txt,
                            'fontRaw': sf,
                            'fontName': matched['name'] if matched else sf,
                            'fontWeight': matched['weight'] if matched else 'normal',
                            'fontStyle': matched['style'] if matched else 'normal',
                            'fontKey': matched['cacheKey'] if matched else '',
                            'size': round(span.get('size', 12), 1),
                            'bbox': [round(x, 2) for x in span.get('bbox', [])],
                        })
        except Exception as e:
            print(f"  ✗ Text map error on page {page_num}: {e}")
        page_text_font_map[page_num] = spans

    doc.close()

    all_fonts = list(standard_fonts_found.values()) + list(extracted_fonts.values())
    print(f"\n✅ Done: {len(standard_fonts_found)} standard + {len(extracted_fonts)} embedded fonts")

    return jsonify({
        'fonts': all_fonts,
        'pageTextFontMap': page_text_font_map,
        'totalFonts': len(all_fonts),
        'standardCount': len(standard_fonts_found),
        'embeddedCount': len(extracted_fonts),
    })

@app.route('/font/<cache_key>', methods=['GET'])
def serve_font(cache_key):
    data = FONT_CACHE.get(cache_key)
    if not data:
        return jsonify({'error': 'Not found'}), 404
    mime = {'ttf':'font/ttf','otf':'font/otf','woff':'font/woff','woff2':'font/woff2'}.get(data['ext'].lower(),'font/ttf')
    return send_file(io.BytesIO(data['bytes']), mimetype=mime, download_name=f"{cache_key}.{data['ext']}")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'cachedFonts': len(FONT_CACHE)})

if __name__ == '__main__':
    print("🚀 PDF Font Server on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
