// Shared base template — every book template delegates to this and overrides
// only the parameters it needs (fonts, chapter-opener style, spacing).  All
// of the typesetting logic (front matter, folio/running-head rules, chapter
// openers, ToC, quotes, orphan-safe headings) lives here in one place.
//
// Targets Typst 0.11.1 (the pinned binary in bin/ and the Dockerfile): no
// `context`, no `block(sticky:)`, no `par(spacing:)`.

// --- Shared states --------------------------------------------------------
// folio-style: how the footer/header prints page numbers on the current page.
//   "none" — display pages (half-title, title, copyright, dedication, epigraph)
//   "i"    — roman numerals for front-matter text (ToC, preface, foreword)
//   "1"    — arabic numerals for the body (reset to 1 at the first chapter)
#let folio-style = state("racana-folio-style", "none")
// The current level-1 heading's metadata, set by `chapter()` right before the
// heading so the show rule and the ToC can read it at the heading's location.
#let h1-kind = state("racana-h1-kind", "chapter")   // "chapter" | "part" | "matter"
#let h1-number = state("racana-h1-number", 0)
#let h1-label = state("racana-h1-label", "")
#let h1-subtitle = state("racana-h1-subtitle", "")

// Every visible flow element drops an invisible marker so header/footer can
// tell whether a page carries content.  Pages without a marker are the blank
// filler pages inserted by `pagebreak(to: "odd")` and get no folio or head.
//
// Only marks inside the text area count (`area` = (top, bottom) y bounds):
//  - The running head and folio are paragraphs too, so they drop marks in the
//    header/footer bands; counting those let a blank page's own furniture
//    keep it looking like content.
//  - Marks sit *after* their element, so when an element ends exactly at the
//    foot of a page its mark spills alone to the very top of the next page.
//    A trailing mark therefore only counts below the top edge; a `lead-mark`
//    (placed deliberately at the top, e.g. by chapter openers) always counts.
#let content-mark = [#metadata(none) <racana-content>]
#let lead-mark = [#metadata("lead") <racana-content>]
#let page-marks(loc, area) = query(<racana-content>, loc).filter(m => {
  let pos = m.location().position()
  let (top, bottom) = area
  pos.page == loc.page() and pos.y <= bottom + 0.5pt and (
    if m.value == "lead" { pos.y >= top - 0.5pt } else { pos.y > top + 0.5pt }
  )
})
#let page-has-content(loc, area) = page-marks(loc, area).len() > 0
// The folio style in force on a page is the state as seen by the page's
// first visible element — header/footer locations sit outside the flow, so
// reading the state there would miss updates made at the top of the page.
#let page-folio-style(loc, area) = {
  let marks = page-marks(loc, area)
  if marks.len() == 0 { "none" } else { folio-style.at(marks.first().location()) }
}
#let page-opens-chapter(loc) = query(heading.where(level: 1), loc).any(h => h.location().page() == loc.page())
// Part openers suppress even the drop folio — they carry no page furniture.
#let page-opens-part(loc) = query(heading.where(level: 1), loc).any(h =>
  h.location().page() == loc.page() and h1-kind.at(h.location()) == "part"
)

// Number words for chapter eyebrows ("Chapter One").  Falls back to digits.
#let number-word(n) = {
  let words = ("One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
    "Nineteen", "Twenty", "Twenty-One", "Twenty-Two", "Twenty-Three", "Twenty-Four", "Twenty-Five",
    "Twenty-Six", "Twenty-Seven", "Twenty-Eight", "Twenty-Nine", "Thirty")
  if n >= 1 and n <= words.len() { words.at(n - 1) } else { str(n) }
}

// --- Public: level-1 section opener ---------------------------------------
// The generator calls this for every chapter, part divider and back-matter
// section instead of writing `= Title` directly, so the opener knows what it
// is.  `number` is the chapter ordinal (0 = unnumbered); `label` overrides the
// eyebrow text (e.g. "Prologue", "Part One").
//
// The page break lives here rather than in the heading show rule: Typst 0.11
// collapses two adjacent weak page breaks into the later one, which would
// make `begin-body()`'s recto break lose its parity when the chapter opener
// follows it.  `first: true` means the caller already broke the page.
#let chapter(kind: "chapter", number: 0, label: "", subtitle: none, recto: true, first: false, title) = {
  if not first {
    if recto or kind == "part" { pagebreak(to: "odd", weak: true) } else { pagebreak(weak: true) }
  }
  h1-kind.update(kind)
  h1-number.update(number)
  h1-label.update(label)
  h1-subtitle.update(subtitle)
  heading(level: 1, title)
  if kind == "part" {
    // A part divider is a display page — it must be closed explicitly or a
    // part description paragraph (or worse, the next chapter opener) bleeds
    // onto it. Whatever follows a part starts on the next recto.
    pagebreak(to: "odd", weak: true)
  }
}

// --- Public: start of the numbered body -----------------------------------
// Emitted by the generator right before the first chapter: moves to a fresh
// recto, resets the page counter to 1 and switches folios to arabic.
#let begin-body() = {
  pagebreak(to: "odd", weak: true)
  counter(page).update(1)
  folio-style.update("1")
}

// Front-matter text sections (preface, foreword, ToC) carry roman folios.
// `reset: true` on the first call makes it page "i" — roman numbering starts
// at the first numbered page, not at the unnumbered half-title.
#let begin-front-text(reset: false) = {
  pagebreak(to: "odd", weak: true)
  if reset { counter(page).update(1) }
  folio-style.update("i")
}

// Display pages (dedication, epigraph) carry no folio.
#let begin-display-page(recto: true) = {
  if recto { pagebreak(to: "odd", weak: true) } else { pagebreak(weak: true) }
  folio-style.update("none")
}

// --- Public: table of contents --------------------------------------------
#let book-toc(
  title: "Contents",
  headingFont: "EB Garamond",
  bodyFont: "EB Garamond",
  style: "classic",
  h1Size: 20pt,
  reset: false,
) = {
  begin-front-text(reset: reset)
  v(1in)
  if style == "modern" {
    text(font: headingFont, size: h1Size, weight: "bold")[#title]
  } else {
    align(center)[#text(font: headingFont, size: h1Size, weight: "regular")[#title]]
  }
  v(0.5in)
  set par(first-line-indent: 0pt, justify: false)
  show outline.entry.where(level: 1): it => {
    let loc = it.element.location()
    let kind = h1-kind.at(loc)
    let num = h1-number.at(loc)
    let lbl = h1-label.at(loc)
    let title-text = it.element.body
    let page-no = it.page
    if kind == "part" {
      v(0.6em)
      block(width: 100%, above: 0.8em, below: 0.4em)[
        #text(font: headingFont, size: 1em, tracking: 0.12em)[#upper(if lbl != "" { lbl + "  ·  " } else { "" })#title-text]
      ]
    } else {
      let eyebrow(s) = [#text(size: 0.78em, tracking: 0.12em)[#upper(s)]#h(0.7em)]
      let prefix = if num > 0 {
        if style == "modern" { [#text(weight: "bold")[#num]#h(0.8em)] } else { eyebrow(number-word(num)) }
      } else if lbl != "" {
        eyebrow(lbl)
      } else { [] }
      block(width: 100%, above: 0.45em, below: 0.45em)[#grid(
        columns: (auto, 1fr, auto),
        column-gutter: 0.5em,
        align: (left, bottom, right),
        [#prefix#title-text],
        if style == "modern" { [] } else { line(length: 100%, stroke: (paint: rgb("#9a938a"), thickness: 0.4pt, dash: ("dot", 2pt))) },
        [#page-no],
      )]
    }
    content-mark
  }
  outline(title: none, depth: 1, indent: 0pt)
  // Separate "Practices" list — every practice_box emits a metadata marker
  // (<racana-practice>) carrying its title; entries show folio page numbers.
  locate(loc => {
    let marks = query(<racana-practice>, loc)
    if marks.len() > 0 {
      v(0.7in)
      if style == "modern" {
        text(font: headingFont, size: h1Size * 0.6, weight: "bold")[Practices]
      } else {
        align(center)[#text(font: headingFont, size: h1Size * 0.6)[Practices]]
      }
      v(0.3in)
      for m in marks {
        let label = if type(m.value) == dictionary { m.value.title } else { str(m.value) }
        let pg = counter(page).at(m.location()).first()
        block(width: 100%, above: 0.45em, below: 0.45em)[#grid(
          columns: (auto, 1fr, auto),
          column-gutter: 0.5em,
          align: (left, bottom, right),
          [#label],
          if style != "modern" { line(length: 100%, stroke: (paint: rgb("#9a938a"), thickness: 0.4pt, dash: ("dot", 2pt))) },
          [#pg],
        )]
      }
    }
    content-mark
  })
  content-mark
}

// --- Public: practice box ---------------------------------------------------
// A bordered, tinted, unbreakable block.  When the content is taller than
// ~80% of a page the box is split into chunks, each keeping the frame, and
// continuation chunks carry a "PRACTICE (CONTINUED)" eyebrow.
#let practice-box(label, page-height, ..items) = {
  layout(size => style(styles => {
    let inner-w = size.width - 24pt
    let ink-muted = rgb("#6f6963")
    let eyebrow(txt) = text(size: 9pt, tracking: 0.2em, weight: "bold", fill: ink-muted)[#txt]
    let header(continued) = {
      eyebrow(if continued { "PRACTICE (CONTINUED)" } else { "PRACTICE" })
      if label != "" {
        v(0.05in)
        linebreak()
        text(size: 13pt, weight: "bold")[#label]
      }
      v(0.15in)
    }
    let h-of(c) = measure(block(width: inner-w, c), styles).height
    let parts = items.pos()
    let header-h = h-of(header(false)) + 12pt
    let item-gap = 8pt
    let heights = parts.map(it => h-of(it) + item-gap)
    let total = header-h + heights.fold(0pt, (a, b) => a + b)
    let frame = (body-c) => block(
      inset: 12pt,
      stroke: 0.5pt + rgb("#8a8178"),
      fill: rgb("#f5f2ec"),
      width: 100%,
      breakable: false,
      body-c,
    )
    if total <= 0.8 * page-height {
      frame[#header(false) #parts.join()]
    } else {
      // Too tall for one page — chunk the items, repeating the eyebrow.
      let limit = 0.62 * page-height
      let cont-h = h-of(header(true)) + 12pt
      let chunks = ()
      let cur = ()
      let cur-h = header-h
      for (idx, it) in parts.enumerate() {
        if cur.len() > 0 and cur-h + heights.at(idx) > limit {
          chunks.push(cur)
          cur = ()
          cur-h = cont-h
        }
        cur.push(it)
        cur-h += heights.at(idx)
      }
      if cur.len() > 0 { chunks.push(cur) }
      for (i, chunk) in chunks.enumerate() {
        frame[#header(i > 0) #chunk.join()]
        if i < chunks.len() - 1 { v(0.18in) }
      }
    }
  }))
}

#let base-project(
  title: "",
  author: "",
  subtitle: "",
  trimSize: "6x9",
  margins: (inside: 22.22mm, outside: 15.87mm, top: 19.05mm, bottom: 19.05mm),
  bodyFont: "EB Garamond",
  bodySize: 11pt,
  // Line height as a multiple of the body size (1.35 = 14.85pt on 11pt).
  leading: 1.35em,
  headingFont: "EB Garamond",
  h1Size: 24pt,
  h2Size: 16pt,
  h3Size: 14pt,
  chapterOpenRecto: true,
  runningHeaders: true,
  pageNumbers: "bottom_center",
  showColophon: true,
  textLang: "en",
  bleedMm: 0,
  firstLineIndentMm: 4.23,
  paragraphSpacingMm: 0,
  quoteIndentLeftMm: 12,
  quoteIndentRightMm: 12,
  quoteFontSizeEm: 0.95,
  quoteItalic: true,
  // Running head text: "title_chapter" (verso book title / recto chapter),
  // "title_author" (verso author / recto title), "chapter_only", "none".
  runningHeaderFormat: "title_chapter",
  orphanWidowTarget: 2,
  chapterOrnament: "",
  // Chapter-opener and heading personality: "classic" (centered, eyebrow in
  // small caps) or "modern" (left-aligned, oversized numeral, rule).
  chapterStyle: "classic",
  headingSpaceBeforeMm: 8,
  headingSpaceAfterMm: 3,
  // Copyright-page text; newlines separate lines.  Empty = generated default.
  copyright: "",
  year: "",
  // Canonical brand domain (env BRAND_DOMAIN, default racana.pro).
  brandDomain: "racana.pro",
  // Free-preview watermark: a single discreet line in the outer foot margin,
  // only on pages that carry content.  Paid exports set this false.
  previewWatermark: false,
  body
) = {

  let paper-width = 6in
  let paper-height = 9in
  if trimSize == "5x8" {
    paper-width = 5in
    paper-height = 8in
  } else if trimSize == "5.5x8.5" {
    paper-width = 5.5in
    paper-height = 8.5in
  } else if trimSize == "8.5x11" {
    paper-width = 8.5in
    paper-height = 11in
  }
  // KDP/IngramSpark interior bleed: the sheet grows on the outside edge only
  // (the spine edge is bound) and on top and bottom.  The outer, top and
  // bottom margins grow by the same amount so the text block keeps its exact
  // position relative to the trim line.
  let bleed = bleedMm * 1mm
  paper-width = paper-width + bleed
  paper-height = paper-height + 2 * bleed
  let page-margins = (
    inside: margins.inside,
    outside: margins.outside + bleed,
    top: margins.top + bleed,
    bottom: margins.bottom + bleed,
  )
  // Vertical bounds of the text area — see page-marks.
  let text-area = (page-margins.top, paper-height - page-margins.bottom)

  // Convert the line-height multiple into Typst's inter-line gap.  With a
  // fixed 1em text frame (top-edge 0.75em / bottom-edge -0.25em) the line
  // pitch is exactly `leading` × bodySize, independent of font metrics.
  let line-pitch = leading.em * bodySize
  let line-gap = line-pitch - bodySize
  let modern = chapterStyle == "modern"
  let head-size = bodySize * 0.8
  let has-author = author.trim() != ""
  let ink-muted = rgb("#6f6963")

  set document(author: author, title: title)

  let running-text(loc, verso) = {
    if runningHeaderFormat == "none" { return none }
    let chapters = query(selector(heading.where(level: 1)).before(loc), loc)
    let current = if chapters.len() > 0 { chapters.last() } else { none }
    let chapter-title = if current != none { current.body } else { [#title] }
    let t = if runningHeaderFormat == "title_author" {
      if verso { if has-author { [#author] } else { [#title] } } else { [#title] }
    } else if runningHeaderFormat == "chapter_only" {
      chapter-title
    } else {
      if verso { [#title] } else { chapter-title }
    }
    if modern {
      text(font: headingFont, size: head-size * 0.95, tracking: 0.08em, fill: ink-muted)[#upper(t)]
    } else {
      text(font: bodyFont, size: head-size, style: "italic")[#t]
    }
  }

  set page(
    width: paper-width,
    height: paper-height,
    margin: page-margins,
    numbering: "1",
    header: locate(loc => {
      let style = page-folio-style(loc, text-area)
      // Display pages, blank filler pages, part openers and chapter openers
      // never carry a running head.
      if style == "none" { return none }
      if page-opens-chapter(loc) { return none }
      let physical = loc.page()
      let verso = calc.even(physical)
      let folio = numbering(style, counter(page).at(loc).first())
      let head = if runningHeaders and style == "1" { running-text(loc, verso) } else { none }
      set text(font: bodyFont, size: head-size)
      if pageNumbers == "outer_header" {
        // Folio on the outer edge, running text on the inner edge.
        if verso {
          grid(columns: (auto, 1fr), [#folio], align(right)[#head])
        } else {
          grid(columns: (1fr, auto), [#head], align(right)[#folio])
        }
      } else if head != none {
        if verso { align(left)[#head] } else { align(right)[#head] }
      }
    }),
    footer: locate(loc => {
      let style = page-folio-style(loc, text-area)
      if style == "none" { return none }
      // Part openers are completely clean — no folio, no running head.
      if page-opens-part(loc) { return none }
      let physical = loc.page()
      let verso = calc.even(physical)
      let folio = numbering(style, counter(page).at(loc).first())
      set text(font: bodyFont, size: head-size)
      // Free-preview watermark: one discreet line in the outer foot margin,
      // 6.5pt, 40% grey.  Skipped on blanks (style "none"), display pages and
      // part openers; chapter openers keep it.
      let wm = if previewWatermark and page-has-content(loc, text-area) {
        place(
          bottom + (if verso { left } else { right }),
          text(size: 6.5pt, fill: luma(60%))[Preview · #brandDomain],
        )
      } else { none }
      if pageNumbers == "bottom_center" or page-opens-chapter(loc) {
        // Chapter openers always take a centered drop folio, even when the
        // template otherwise numbers in the header.
        [#align(center)[#folio] #wm]
      } else if wm != none {
        wm
      }
    })
  )

  set text(font: bodyFont, size: bodySize, lang: textLang, hyphenate: true, top-edge: 0.75em, bottom-edge: -0.25em)
  // Real typographic quotes — straight quotes in the source are converted.
  set smartquote(enabled: true)
  // Widows and orphans: Typst's flow layout already keeps at least two lines
  // of a paragraph together at a page break (verified on 0.11.1).
  set par(justify: true, leading: line-gap, first-line-indent: firstLineIndentMm * 1mm)
  show par: set block(spacing: line-gap + paragraphSpacingMm * 1mm)

  // Mark everything visible so blank filler pages can be told apart.
  show par: it => { it; content-mark }
  show heading: it => { it; content-mark }
  show list: it => { it; content-mark }
  show enum: it => { it; content-mark }
  show table: it => { it; content-mark }
  show figure: it => { it; content-mark }
  show image: it => { it; content-mark }
  show quote: it => { it; content-mark }

  set list(indent: 1.5em, body-indent: 0.6em)
  set enum(indent: 1.5em, body-indent: 0.6em)
  show list: set block(above: line-pitch * 0.5, below: line-pitch * 0.5)
  show enum: set block(above: line-pitch * 0.5, below: line-pitch * 0.5)

  // --- Block quotes -----------------------------------------------------
  show quote.where(block: true): it => {
    block(
      width: 100%,
      inset: (left: quoteIndentLeftMm * 1mm, right: quoteIndentRightMm * 1mm),
      above: line-pitch * 0.9,
      below: line-pitch * 0.9,
    )[
      #set par(first-line-indent: 0pt, leading: line-gap * 0.9)
      #set text(size: quoteFontSizeEm * bodySize, style: if quoteItalic { "italic" } else { "normal" })
      #it.body
      #if it.attribution != none [
        #set text(style: "normal", size: quoteFontSizeEm * bodySize * 0.95)
        #v(0.2em)
        #align(right)[— #it.attribution]
      ]
    ]
    content-mark
  }

  // --- Tables & figures --------------------------------------------------
  set table(stroke: 0.4pt + rgb("#8a8178"), inset: 0.45em)
  show table: set text(size: bodySize * 0.9)
  show figure.caption: set text(size: bodySize * 0.85, style: "italic")

  // --- Chapter openers (level 1) ----------------------------------------
  show heading.where(level: 1): it => {
    locate(loc => {
      let kind = h1-kind.at(loc)
      let num = h1-number.at(loc)
      let lbl = h1-label.at(loc)
      let eyebrow = if lbl != "" { lbl } else if num > 0 { "Chapter " + number-word(num) } else { "" }
      set par(justify: false, first-line-indent: 0pt)
      lead-mark
      let sub = h1-subtitle.at(loc)
      let subText = if type(sub) == "string" { if sub == "" { none } else { sub } }
                    else { if type(sub) == "content" { sub } else { none } }
      if kind == "part" {
        // Part opener: own recto, vertically centred, small-caps part number,
        // title, italic subtitle.  No running head, no folio (suppressed in
        // header/footer via page-opens-part).
        v(1fr)
        align(center)[
          #if eyebrow != "" [
            #text(font: headingFont, size: bodySize * 1.05, tracking: 0.22em)[#upper(eyebrow)]
            #v(0.4in)
          ]
          #text(font: headingFont, size: h1Size * 1.25, weight: if modern { "bold" } else { "regular" })[#it.body]
          #if subText != none [
            #v(0.3in)
            #text(font: bodyFont, size: bodySize * 1.05, style: "italic", fill: ink-muted)[#subText]
          ]
        ]
        v(1.4fr)
      } else if modern {
        v(paper-height * 0.15)
        if num > 0 {
          text(font: headingFont, size: h1Size * 2.6, weight: "bold", fill: ink-muted)[#num]
          v(0.05in)
        } else if eyebrow != "" {
          text(font: headingFont, size: bodySize * 0.85, tracking: 0.2em, fill: ink-muted)[#upper(eyebrow)]
          v(0.2in)
        }
        text(font: headingFont, size: h1Size, weight: "bold")[#it.body]
        v(0.12in)
        line(length: 1.2in, stroke: 1pt + ink-muted)
        v(0.45in)
      } else {
        // Classic chapter opener: sink ~20% of the page, small-caps
        // "CHAPTER N" eyebrow above the title, then a short rule.
        v(paper-height * 0.18)
        align(center)[
          #if eyebrow != "" [
            #text(font: headingFont, size: bodySize * 0.9, tracking: 0.22em)[#upper(eyebrow)]
            #v(0.28in)
          ]
          #text(font: headingFont, size: h1Size, weight: "regular")[#it.body]
          #v(0.28in)
          #if chapterOrnament != "" {
            text(font: headingFont, size: 13pt)[#chapterOrnament]
          } else {
            line(length: 0.9in, stroke: 0.5pt + ink-muted)
          }
        ]
        v(0.55in)
      }
    })
  }

  // --- Sub-headings: never indented, never justified, never orphaned ----
  // Typst 0.11 has no keep-with-next, so the heading block reserves two
  // body lines below itself and the negative skip hands the space back.
  let keep-lines = 2 * line-pitch
  let subheading(it, size, weight, style) = {
    block(
      width: 100%,
      breakable: false,
      above: headingSpaceBeforeMm * 1mm,
      below: 0pt,
    )[
      #set par(first-line-indent: 0pt, justify: false)
      #text(font: headingFont, size: size, weight: weight, style: style)[#it.body]
      #v(headingSpaceAfterMm * 1mm)
      #v(keep-lines)
    ]
    v(-keep-lines)
    content-mark
  }
  show heading.where(level: 2): it => subheading(it, h2Size, "bold", "normal")
  show heading.where(level: 3): it => subheading(it, h3Size, if modern { "bold" } else { "regular" }, if modern { "normal" } else { "italic" })

  // =====================================================================
  // Front matter rendered by the template: half-title → title → copyright.
  // =====================================================================
  folio-style.update("none")

  // Half-title (recto)
  v(2.2in)
  align(center)[#text(font: headingFont, size: h1Size * 0.9, weight: if modern { "bold" } else { "regular" })[#title]]
  pagebreak()
  pagebreak(to: "odd", weak: true)

  // Title page (recto)
  v(1.8in)
  align(center)[
    #set par(justify: false)
    #text(font: headingFont, size: 30pt, weight: "bold")[#title]
    #if subtitle != "" [
      #v(0.3in)
      #text(font: headingFont, size: 15pt, style: if modern { "normal" } else { "italic" })[#subtitle]
    ]
    #if has-author [
      #v(1.2in)
      #text(font: headingFont, size: 15pt, tracking: if modern { 0.12em } else { 0em })[#if modern { upper(author) } else { author }]
    ]
  ]
  pagebreak()

  // Copyright page (verso)
  {
    set par(justify: false, first-line-indent: 0pt, leading: line-gap * 0.9)
    set text(size: bodySize * 0.8)
    v(1fr)
    if type(copyright) == "content" {
      // Author-supplied copyright text arrives as markup content — smartquote
      // and Devanagari spans already applied by the generator.
      copyright
    } else {
      let lines = if copyright != "" { copyright.split("\n") } else {
        let yr = if year != "" { year } else { str(datetime.today().year()) }
        let cr = if has-author { "Copyright © " + yr + " " + author } else { "Copyright © " + yr }
        (title, "", cr, "All rights reserved.", "",
         "No part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.")
      }
      for l in lines {
        if l == "" { v(0.5em) } else { par(l) }
      }
    }
  }
  pagebreak()

  body

  if showColophon {
    pagebreak(to: "even", weak: true)
    folio-style.update("none")
    v(1fr)
    align(center)[
      #set par(justify: false, first-line-indent: 0pt)
      #text(size: 8pt, fill: ink-muted)[Typeset by Racana]
      #linebreak()
      #text(size: 7.5pt, fill: rgb("#a39e96"))[#brandDomain · your manuscript in, your finished book out.]
    ]
  }

  // Padding to a signature multiple is done post-compile in
  // publication-renderer.ts (pdf-lib appends truly blank leaves).  Doing it
  // in Typst makes layout non-convergent — the pad count self-references the
  // page count that the padding itself changes.
}

// Public entry point — the generator imports `project` from each template.
#let project(..args) = base-project(..args)
