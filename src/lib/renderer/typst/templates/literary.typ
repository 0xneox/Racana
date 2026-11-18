// Literary template — Libre Baskerville, tight leading, minimal indent.
#import "classic.typ": base-project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box

#let defaults = (
  bodyFont: "Libre Baskerville",
  bodySize: 10.5pt,
  leading: 1.45em,
  headingFont: "Libre Baskerville",
  h1Size: 21pt,
  h2Size: 15pt,
  h3Size: 12pt,
  firstLineIndentMm: 3,
  quoteIndentLeftMm: 11,
  quoteIndentRightMm: 11,
  quoteFontSizeEm: 0.93,
  runningHeaderFormat: "title_author",
)

// Template defaults are merged under whatever the generator passes, so a
// JSON definition or user setting always wins over the template default.
#let project(..args) = base-project(..(defaults + args.named()), ..args.pos())
