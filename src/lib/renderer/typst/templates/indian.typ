// Indian Classical template — Devanagari fonts and the danda chapter ornament.
#import "classic.typ": base-project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box

#let defaults = (
  bodyFont: "Noto Serif Devanagari",
  bodySize: 11.5pt,
  leading: 1.5em,
  headingFont: "Noto Serif Devanagari",
  h1Size: 22pt,
  h2Size: 16pt,
  h3Size: 13.5pt,
  textLang: "hi",
  firstLineIndentMm: 4.5,
  quoteIndentLeftMm: 11,
  quoteIndentRightMm: 11,
  quoteFontSizeEm: 0.93,
  runningHeaderFormat: "title_author",
  chapterOrnament: "॥",
)

// Template defaults are merged under whatever the generator passes, so a
// JSON definition or user setting always wins over the template default.
#let project(..args) = base-project(..(defaults + args.named()), ..args.pos())
