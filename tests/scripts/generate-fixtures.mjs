import { deflateRawSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16LE(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function uint32LE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

const LOCAL_FILE_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CENTRAL_DIR_SIG = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const END_CENTRAL_DIR_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

class ZipWriter {
  constructor() {
    this.entries = [];
  }

  addFile(path, contentBuffer, options = {}) {
    const { compress = true } = options;
    const uncompressed = Buffer.isBuffer(contentBuffer) ? contentBuffer : Buffer.from(contentBuffer, 'utf8');
    const uncompressedSize = uncompressed.length;
    const crc = crc32(uncompressed);

    let compressed;
    let compressionMethod;
    if (compress && uncompressedSize > 0) {
      compressed = deflateRawSync(uncompressed, { level: 9 });
      compressionMethod = 8;
    } else {
      compressed = uncompressed;
      compressionMethod = 0;
    }
    const compressedSize = compressed.length;

    this.entries.push({
      path,
      uncompressed,
      compressed,
      uncompressedSize,
      compressedSize,
      crc,
      compressionMethod,
    });
  }

  build() {
    const chunks = [];
    const centralDirChunks = [];
    let offset = 0;

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.path, 'utf8');
      const nameLen = nameBuf.length;

      const localHeader = Buffer.concat([
        LOCAL_FILE_SIG,
        uint16LE(20),
        uint16LE(0),
        uint16LE(entry.compressionMethod),
        uint16LE(0),
        uint16LE(0),
        uint32LE(entry.crc),
        uint32LE(entry.compressedSize),
        uint32LE(entry.uncompressedSize),
        uint16LE(nameLen),
        uint16LE(0),
        nameBuf,
      ]);

      chunks.push(localHeader);
      chunks.push(entry.compressed);

      const localHeaderSize = localHeader.length;

      const centralHeader = Buffer.concat([
        CENTRAL_DIR_SIG,
        uint16LE(20),
        uint16LE(20),
        uint16LE(0),
        uint16LE(entry.compressionMethod),
        uint16LE(0),
        uint16LE(0),
        uint32LE(entry.crc),
        uint32LE(entry.compressedSize),
        uint32LE(entry.uncompressedSize),
        uint16LE(nameLen),
        uint16LE(0),
        uint16LE(0),
        uint16LE(0),
        uint16LE(0),
        uint32LE(0),
        uint32LE(offset),
        nameBuf,
      ]);

      centralDirChunks.push(centralHeader);
      offset += localHeaderSize + entry.compressedSize;
    }

    const centralDir = Buffer.concat(centralDirChunks);
    const centralDirSize = centralDir.length;
    const centralDirOffset = offset;
    const entries = this.entries.length;

    const endCentralDir = Buffer.concat([
      END_CENTRAL_DIR_SIG,
      uint16LE(0),
      uint16LE(0),
      uint16LE(entries),
      uint16LE(entries),
      uint32LE(centralDirSize),
      uint32LE(centralDirOffset),
      uint16LE(0),
    ]);

    chunks.push(centralDir);
    chunks.push(endCentralDir);

    return Buffer.concat(chunks);
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraph(runs, options = {}) {
  const { styleId, numPr, jc } = options;
  const parts = [];
  if (styleId) {
    parts.push(`<w:pPr><w:pStyle w:val="${styleId}"/>`);
    if (jc) parts.push(`<w:jc w:val="${jc}"/>`);
    if (numPr) parts.push(numPr);
    parts.push(`</w:pPr>`);
  } else if (numPr || jc) {
    parts.push('<w:pPr>');
    if (jc) parts.push(`<w:jc w:val="${jc}"/>`);
    if (numPr) parts.push(numPr);
    parts.push('</w:pPr>');
  }
  for (const run of runs) {
    if (typeof run === 'string') {
      parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(run)}</w:t></w:r>`);
    } else {
      const rPr = [];
      if (run.bold) rPr.push('<w:b/>');
      if (run.italic) rPr.push('<w:i/>');
      if (run.quoteStyle) {
        rPr.push(`<w:rStyle w:val="QuoteChar"/>`);
      }
      const rPrStr = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
      parts.push(`<w:r>${rPrStr}<w:t xml:space="preserve">${escapeXml(run.text || '')}</w:t></w:r>`);
    }
  }
  return `<w:p>${parts.join('')}</w:p>`;
}

function heading1(text) {
  return paragraph([text], { styleId: 'Heading1' });
}

function heading2(text) {
  return paragraph([text], { styleId: 'Heading2' });
}

function numberedParagraph(text, ilvl, numId) {
  const numPr = `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`;
  return paragraph([text], { numPr });
}

function blockQuote(text) {
  return paragraph([{ text, quoteStyle: true }], { styleId: 'Quote' });
}

function tableCell(paragraphs, opts = {}) {
  const tcPr = opts.shading
    ? `<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/></w:tcPr>`
    : '';
  return `<w:tc>${tcPr}${paragraphs.join('')}</w:tc>`;
}

function tableRow(cells) {
  return `<w:tr>${cells.join('')}</w:tr>`;
}

function table(rows) {
  const tblPr = `<w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="2000"/>
    <w:gridCol w:w="2000"/>
    <w:gridCol w:w="2000"/>
  </w:tblGrid>`;
  return `<w:tbl>${tblPr}${rows.join('')}</w:tbl>`;
}

function footnoteReference(id) {
  return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
}

function documentXml(bodyContent, rels = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function contentTypesXml(extraOverrides = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  ${extraOverrides.join('\n  ')}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelsXml(extraRels = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  ${extraRels.join('\n  ')}
</Relationships>`;
}

function stylesXml(extraStyles = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:uiPriority w:val="9"/>
    <w:pPr><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:uiPriority w:val="9"/>
    <w:pPr><w:spacing w:before="280" w:after="160"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:uiPriority w:val="25"/>
    <w:pPr><w:ind w:left="720" w:right="720"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:i/><w:iCs/><w:color w:val="595959"/></w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="QuoteChar">
    <w:name w:val="Quote Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="25"/>
    <w:rPr><w:i/><w:iCs/></w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="FootnoteReference">
    <w:name w:val="footnote reference"/>
    <w:uiPriority w:val="25"/>
    <w:rPr><w:vertAlign w:val="superscript"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FootnoteText">
    <w:name w:val="footnote text"/>
    <w:basedOn w:val="Normal"/>
    <w:uiPriority w:val="25"/>
    <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="360" w:hanging="360"/></w:pPr>
    <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
  </w:style>
  ${extraStyles.join('\n  ')}
</w:styles>`;
}

function numberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:nsid w:val="FFFFFF80"/>
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="1">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="%2."/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;
}

function footnotesXml(entries) {
  const parts = entries.map(([id, text]) => {
    return `<w:footnote w:id="${id}" w:type="normal">
      ${paragraph([
        { text: String(id), style: 'FootnoteReference' },
      ], { styleId: 'FootnoteText' }).replace('</w:pPr>', `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r> <w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)}
    </w:footnote>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:id="0" w:type="separator"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1" w:type="continuationSeparator"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
  ${parts.join('\n  ')}
</w:footnotes>`;
}

function buildDocx({ body, contentTypesExtra = [], docRelsExtra = [], footnotes = null, stylesExtra = [] }) {
  const zip = new ZipWriter();

  zip.addFile('[Content_Types].xml', contentTypesXml(contentTypesExtra));
  zip.addFile('_rels/.rels', rootRelsXml());
  zip.addFile('word/document.xml', documentXml(body));
  zip.addFile('word/_rels/document.xml.rels', documentRelsXml(docRelsExtra));
  zip.addFile('word/styles.xml', stylesXml(stylesExtra));
  zip.addFile('word/numbering.xml', numberingXml());

  if (footnotes) {
    zip.addFile('word/footnotes.xml', footnotesXml(footnotes.list));
    zip.addFile('word/_rels/footnotes.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  }

  return zip.build();
}

function makeNovelChaptersDocx() {
  const body = [];

  body.push(heading1('Chapter 1: The Beginning'));
  body.push(paragraph([
    'The morning light crept through the tall windows of the old library, casting long golden stripes across the worn oak floor. Dust motes danced in the beams, their slow movements almost hypnotic as they drifted toward the rows of shelves that seemed to stretch on forever.',
  ]));
  body.push(paragraph([
    'Elena paused at the entrance, her hand resting lightly on the weathered doorframe. She had not been here in nearly twenty years, yet everything looked exactly as she remembered it—the smell of old paper and leather bindings, the ticking of the grandfather clock in the corner, the faded velvet curtains tied back with heavy silk ropes.',
  ]));
  body.push(blockQuote('Every great journey begins with a single step, but it is the courage to return that truly defines us.'));
  body.push(paragraph([
    'She took a deep breath and stepped forward, her shoes clicking softly against the planks. Each step echoed with memories long buried, each breath drawn in carried the faint hope that somewhere within these walls lay the answer she had been searching for all these years.',
  ]));
  body.push(paragraph([
    'The first task before her was simple enough, yet it felt monumental. She would need to sort through the letters in the west wing, catalog the maps in the east gallery, and verify the first editions in the main hall. What sounded to an outsider like a tedious afternoon of librarian work was, to her, the beginning of a reckoning.',
  ]));
  body.push(heading2('Key Discoveries Awaiting'));
  body.push(numberedParagraph('Letters from Grandfather, dated between 1890 and 1912', 0, 1));
  body.push(numberedParagraph('A bundle of hand-drawn maritime charts tied with blue ribbon', 0, 1));
  body.push(numberedParagraph('The first edition folio of Morte d\'Arthur with annotated margins', 0, 1));
  body.push(paragraph([
    'Beyond these formal tasks, there lingered a question she had never dared to voice aloud, a question that had followed her from childhood into adulthood and now into middle age: why had her grandfather chosen her, of all his descendants, to be the custodian of this place and all that it contained?',
  ]));
  body.push(blockQuote('The keys to a great inheritance are seldom forged in steel; they are forged in the long discipline of patient waiting.'));
  body.push(paragraph([
    'She walked now to the west wing and paused before the first stack of pine boxes, each neatly labeled in the strong, clear handwriting that had addressed birthday cards and school reports for so many years. One of them, she saw, bore her own name. She would save that one for last, she decided; she would earn the right to open it by completing the rest of her work faithfully and without haste.',
  ]));

  body.push(heading1('Chapter 2: The Middle'));
  body.push(paragraph([
    'By noon the sun stood high overhead, and the library had warmed considerably. Elena had worked her way through three boxes of correspondence, her fingers smudged with ink and dust, her mind reeling at the breadth of what she had found. There were stories here she had never heard—accounts of voyages, of friendships, of quiet griefs suffered alone.',
  ]));
  body.push(paragraph([
    'She paused to drink from a chipped teacup she had found on a side table, miraculously still intact. Through the window she could see the rolling green of the estate, the sheep grazing peacefully in the distance, and far beyond them the glint of the river where she had learned to skip stones as a child.',
  ]));
  body.push(blockQuote('The past is not a foreign country. It is home, and we are forever its guests.'));
  body.push(paragraph([
    'The bundle of maritime charts, when at last she undid the ribbon, proved more remarkable than she had dared hope. They were not merely charts of known coastlines; they were sketches of routes never sailed, notations of islands marked only in legend, and careful calculations of currents that had been thought undiscovered until the previous century.',
  ]));
  body.push(paragraph([
    'Elena spread them across the great central table, weighing down the corners with brass candlesticks. She traced the careful lines with her fingertip and tried to imagine the hand that had drawn them, the eyes that had gazed at the same stars from the deck of a heaving ship, the heart that had dared to believe in what lay beyond the horizon.',
  ]));
  body.push(heading2('Patterns Begin to Emerge'));
  body.push(numberedParagraph('Each chart bears a small red stamp in the bottom-right corner', 0, 1));
  body.push(numberedParagraph('The latitudes and longitudes encode a repeating sequence', 0, 1));
  body.push(numberedParagraph('A note tucked in the last chart reads simply: "Follow the heron"', 0, 1));
  body.push(paragraph([
    'Far above her, on the second floor gallery, a floorboard creaked. She looked up, half-expecting to see a face she both longed for and dreaded; but the gallery was empty, the long afternoon light falling through leaded windows onto empty passageways and closed doors. The house, she thought, remembered more than she did, and perhaps it always would.',
  ]));
  body.push(blockQuote('Maps are not the territory, but they hold within their folded lines the shape of a longing—the longing to go, to see, to return bearing treasure.'));
  body.push(paragraph([
    'She began to notice now that the annotations in the margins of the charts shared certain peculiar turns of phrase with the letters she had been sorting that morning. They were the same hand, without doubt—but more than that, they were the same mind, thinking aloud to itself across decades, addressing a reader it hoped would one day exist and would know how to listen.',
  ]));

  body.push(heading1('Chapter 3: The End'));
  body.push(paragraph([
    'Twilight painted the windows in hues of violet and rose by the time Elena reached the final item on her list: the first edition folio of Morte d\'Arthur. It rested on a shelf in the farthest corner of the main hall, its leather binding cracked and faded, its pages gilded along the edges with a gold that had dulled with the centuries.',
  ]));
  body.push(paragraph([
    'She lifted it gently, almost reverently, and carried it to the table where the charts still lay spread. As she opened the cover, a folded sheet of heavy cream paper slipped out and fluttered to the surface. It was not a letter. It was not a map. It was a deed, and the name upon it, written in the hand of her grandfather, was her own.',
  ]));
  body.push(blockQuote('Every ending is but a new beginning in disguise, and every inheritance carries with it a call to adventure.'));
  body.push(paragraph([
    'For a long time she sat in silence, the deed before her, the great clock ticking the seconds away, the last light fading from the sky. Outside, somewhere in the darkness, a heron cried—a long, lonely, hopeful sound—and Elena smiled.',
  ]));
  body.push(paragraph([
    'She folded the deed carefully, placed it inside the folio, and closed the cover. Then she stood, rolled the charts, retied the blue ribbon, and stacked the letters neatly into their box. The work of sorting, cataloging, and verifying was done, but the work of understanding, of following, of becoming—this, she knew, had only just begun.',
  ]));
  body.push(heading2('What Comes Next'));
  body.push(numberedParagraph('She will set out at first light for the coast on the old maps', 0, 1));
  body.push(numberedParagraph('At the mouth of the river she will hire a boat and a crew', 0, 1));
  body.push(numberedParagraph('She will follow the heron, wherever it may lead', 0, 1));
  body.push(paragraph([
    'As she doused the last of the lamps and made her way to the door through which she had entered that morning, she paused again on the threshold, turned, and looked back. The long galleries were in darkness now, but in her memory she could still see them lit, could still hear the clock, could still smell the leather and the paper and the lavender sachets her grandmother had tucked between the shelves.',
  ]));
  body.push(blockQuote('Home is not a place, though we speak of it as though it were. Home is a key turned in a familiar lock, a face you have loved for a lifetime, a story you have carried in your bones and finally found the courage to begin.'));
  body.push(paragraph([
    'She closed the door softly behind her, but she did not lock it. There would be tomorrow, and the day after tomorrow, and all the days that would follow. The library would be here, waiting. And so, she felt certain, would the heron—waiting by the river at the end of the lane, patient as only a bird of passage can be, ready to lead her out into the wide world that her grandfather, in the quiet hours of his own long life, had first mapped out for her with ink and parchment and hope.',
  ]));

  return buildDocx({ body: body.join('\n    ') });
}

function makePhilosophyMeditationsDocx() {
  const body = [];

  body.push(heading1('Meditations'));
  body.push(paragraph([
    'A private journal of reflections, composed in quiet hours, for the improvement of the soul and the ordering of the mind. These are not teachings for others, but reminders for the self—reminders of what has been learned, of what has been forgotten, and of what must be practiced each day if one is to live with integrity and peace.',
  ]));
  body.push(paragraph([{ text: 'ॐ नमः शिवाय', bold: true }]));
  body.push(paragraph([
    'The sacred syllable grounds the beginning, as it grounds all things. Let the writing of these meditations be an act of devotion as much as an act of thought, and let each word be uttered first in the silence of the heart before it is committed to paper.',
  ]));

  body.push(heading1('Book I'));
  body.push(heading2('I.1: On Debt and Gratitude'));
  body.push(paragraph([
    'From my grandfather I learned the value of patience and the art of listening, not only to the words that people speak but to the silences between them. He was a man of few words, and those he uttered he weighed carefully, as a goldsmith weighs coins upon his scales.',
  ]));
  body.push(blockQuote('We do not inherit the world from our ancestors; we borrow it from our children, and we must return it better than we found it.'));
  body.push(paragraph([
    'From my mother I learned kindness without weakness, generosity without ostentation, and the quiet courage that endures misfortune without complaint. Her piety was of a gentle kind; she spoke little of the gods, but her every action was a prayer.',
  ]));
  body.push(paragraph([
    'From my teachers I learned that the greatest lesson is not to be found in any book, but in the humble recognition that you still have much to learn. The pursuit of wisdom begins with the admission of ignorance and continues with the patient work of a lifetime.',
  ]));
  body.push(heading2('I.2: On the Shortness of Life'));
  body.push(paragraph([
    'Men complain that life is short, and yet they waste the greater part of it as though it were endless. They squander hours on trivial pursuits, on quarrels, on gossip, on the pursuit of honors that will be forgotten before the funeral wreaths have withered.',
  ]));
  body.push(blockQuote('It is not that we have so little time, but that we lose so much of it. Life is long enough, and a sufficiently generous amount has been given to us for the accomplishment of the very greatest things, if all of it were well invested.'));
  body.push(paragraph([
    'Consider how many years you have already spent in sleep, in idle conversation, in spectacles and entertainments, in fretting over things you cannot change. When you tally them up honestly, you will find that you are older than you thought, and younger than you ought to be.',
  ]));
  body.push(paragraph([
    'Each morning remind yourself: today I shall meet with meddling, with ingratitude, with insolence, with dishonesty, with envy, with selfishness. All these things happen because those who commit them know not good from evil. But I have seen the nature of the good and the nature of the evil, and I know that even those who wrong me are my kin, not by blood but by participation in the same divine reason.',
  ]));
  body.push(heading2('I.3: On Living in Accord with Nature'));
  body.push(paragraph([
    'The universe is governed by a rational order, and our highest good is to live in accordance with that order. This does not mean passively accepting every injury; it means distinguishing between what is within our power and what is not, and expending our energy only where it may bear fruit.',
  ]));
  body.push(blockQuote('Some things are up to us, and some are not up to us. What is up to us: our opinions, our impulses, our desires, our aversions, and, in a word, whatever is our own doing. What is not up to us: our bodies, our property, our reputation, our public offices, and, in a word, whatever is not our own doing.'));
  body.push(paragraph([
    'You cannot control the weather. You cannot control the actions of others. You cannot control whether you are praised or blamed, promoted or dismissed, loved or rejected. What you can control is your own judgment, your own will, your own character—and these are sufficient for a life of flourishing, if you will but cultivate them with care.',
  ]));

  body.push(heading1('Book II'));
  body.push(heading2('II.1: On Mindfulness and Presence'));
  body.push(paragraph([
    'Waste no more time arguing about what a good man should be. Be one. Do not discourse upon virtue; embody it. Let your actions speak, and let your words be few, and those few chosen with the same care that you would use to select stones for a foundation.',
  ]));
  body.push(blockQuote('The present is the only thing of which a man can be deprived, if indeed he can be deprived of anything at all; for this is the only thing that he has, and no man can lose what he has not got.'));
  body.push(paragraph([
    'Do not brood over the past as though it could be changed, nor torment yourself over the future as though it were already here. The only moment that is yours is the one that is now. Live it fully. Live it well. Live it in accordance with the best that is within you.',
  ]));
  body.push(paragraph([
    'When you arise in the morning, think of what a precious privilege it is to be alive—to breathe, to think, to enjoy, to love. Not one of these things is guaranteed. Not one of them is owed to you. They are gifts, and the appropriate response to a gift is gratitude, not complaint.',
  ]));
  body.push(heading2('II.2: On the Fellowship of Humankind'));
  body.push(paragraph([
    'When you are offended at any man\'s fault, immediately turn to yourself and reflect in what like manner you yourself err. For in doing so you will forget your anger, and you will learn the difficult but necessary lesson of forgiveness—not for the sake of the other, though it benefits him also, but for the sake of your own peace of mind.',
  ]));
  body.push(blockQuote('What is not good for the hive is not good for the bee. What injures the community injures the citizen. When you complain of another, remember: you are complaining of a member of your own body.'));
  body.push(paragraph([
    'We are all citizens of the same great city. The differences between us—of language, of custom, of station, of creed—are accidents of birth, not marks of essence. At the deepest level, every human being shares the same origin, the same dignity, and the same destiny.',
  ]));

  body.push(heading2('II.3: A Table of the Virtues and Their Practice'));
  const t = table([
    tableRow([
      tableCell([paragraph([{ text: 'Virtue', bold: true }])], { shading: 'D9E2F3' }),
      tableCell([paragraph([{ text: 'Definition', bold: true }])], { shading: 'D9E2F3' }),
      tableCell([paragraph([{ text: 'Daily Practice', bold: true }])], { shading: 'D9E2F3' }),
    ]),
    tableRow([
      tableCell([paragraph(['Wisdom'])]),
      tableCell([paragraph(['The knowledge of good and evil, and of what in each situation is to be done.'])]),
      tableCell([paragraph(['Before you speak or act, pause and ask: Is this the right thing?'])]),
    ]),
    tableRow([
      tableCell([paragraph(['Courage'])]),
      tableCell([paragraph(['The willingness to do what is right, even when it is painful or dangerous.'])]),
      tableCell([paragraph(['Seek out one small opportunity each day to face a fear.'])]),
    ]),
    tableRow([
      tableCell([paragraph(['Justice'])]),
      tableCell([paragraph(['The fair and equitable treatment of all, regardless of their station.'])]),
      tableCell([paragraph(['Ask of every decision: Would I think this fair if I were the other party?'])]),
    ]),
  ]);
  body.push(t);

  body.push(heading2('II.4: Final Observations'));
  body.push(paragraph([
    'Remember that the door is always open. If life becomes unbearable, you may leave it as you would a smoky room, without shame and without regret. But until that moment, stay. Continue. Persevere. Do the work that is yours to do, and do it without complaint.',
  ]));
  body.push(blockQuote('In the morning thou shalt say with thyself: I shall meet with the busy-body, the unthankful, and the insolent. Let it not in any way be possible for thee to be harmed by any of these, if thou wilt not remember that the doer of wrong does thee injury only in so far as thou permittest him.'));
  body.push(paragraph([
    footnoteReference(2)
  ], { styleId: 'Normal' }));
  body.push(paragraph([
    footnoteReference(3)
  ], { styleId: 'Normal' }));
  body.push(paragraph([
    'At the end of each day, before you close your eyes in sleep, review the hours that have passed. Where did you fall short? Where did you rise above yourself? What have you learned, and what will you do differently tomorrow? Do this honestly, without self-flattery and without self-contempt, and you will grow.',
  ]));
  body.push(paragraph([
    'So much for the meditations. May the writing of them have been as useful to the composer as the reading of them, if they ever find a reader, may prove to be. And if no reader should ever find them, then at least they have served their purpose: they have been a mirror for the mind, and a whetstone for the will.',
  ]));

  const footnotesPart = {
    list: [
      [2, 'Marcus Aurelius often returns to this morning practice of premeditation on adversity; compare Book II, 1 and Book XI, 18.'],
      [3, 'The doctrine that harm requires consent is central to Stoic psychology; see Epictetus, Discourses I, 28.'],
    ]
  };

  return buildDocx({
    body: body.join('\n    '),
    contentTypesExtra: [
      '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>',
    ],
    docRelsExtra: [
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>',
    ],
    footnotes: footnotesPart,
  });
}

function main() {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const novelPath = resolve(FIXTURES_DIR, 'novel_chapters.docx');
  const novelBuf = makeNovelChaptersDocx();
  writeFileSync(novelPath, novelBuf);
  console.log(`Wrote ${novelPath} (${novelBuf.length} bytes)`);

  const philoPath = resolve(FIXTURES_DIR, 'philosophy_meditations.docx');
  const philoBuf = makePhilosophyMeditationsDocx();
  writeFileSync(philoPath, philoBuf);
  console.log(`Wrote ${philoPath} (${philoBuf.length} bytes)`);

  console.log('\nFixture generation complete.');
}

main();
