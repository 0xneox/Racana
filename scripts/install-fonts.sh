#!/usr/bin/env bash
set -e
FONT_DIR="public/fonts"
mkdir -p "$FONT_DIR"

echo "Downloading open-license fonts..."

# EB Garamond (SIL OFL)
curl -fsSL -o "$FONT_DIR/EBGaramond-Regular.ttf" "https://github.com/georgd/EB-Garamond/raw/master/fonts/ttf/EBGaramond-Regular.ttf" 2>/dev/null || echo "EBGaramond-Regular skipped"
curl -fsSL -o "$FONT_DIR/EBGaramond-Italic.ttf" "https://github.com/georgd/EB-Garamond/raw/master/fonts/ttf/EBGaramond-Italic.ttf" 2>/dev/null || echo "EBGaramond-Italic skipped"
curl -fsSL -o "$FONT_DIR/EBGaramond-Bold.ttf" "https://github.com/georgd/EB-Garamond/raw/master/fonts/ttf/EBGaramond-Bold.ttf" 2>/dev/null || echo "EBGaramond-Bold skipped"

# Noto Serif Devanagari (SIL OFL via Google fonts mirror)
curl -fsSL -o "$FONT_DIR/NotoSerifDevanagari-Regular.ttf" "https://github.com/notofonts/devanagari/releases/download/NotoSerifDevanagari-v2.008/NotoSerifDevanagari-Regular.ttf" 2>/dev/null || echo "NotoSerifDevanagari skipped"

# Libre Baskerville (placeholder)
curl -fsSL -o "$FONT_DIR/LibreBaskerville-Regular.ttf" "https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf" 2>/dev/null || echo "LibreBaskerville skipped"

# Source Serif Pro (placeholder)
curl -fsSL -o "$FONT_DIR/SourceSerifPro-Regular.ttf" "https://github.com/adobe-fonts/source-serif/raw/release/TTF/SourceSerif4-Regular.ttf" 2>/dev/null || echo "SourceSerifPro skipped"

# Source Sans Pro (placeholder)
curl -fsSL -o "$FONT_DIR/SourceSansPro-Regular.ttf" "https://github.com/adobe-fonts/source-sans/raw/release/TTF/SourceSans3-Regular.ttf" 2>/dev/null || echo "SourceSansPro skipped"

echo "Font download complete. Files in $FONT_DIR:"
ls -la "$FONT_DIR" 2>/dev/null || echo "None"
