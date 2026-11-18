// Philosophy template — contemplative spacing, Libre Baskerville throughout.
#import "classic.typ": base-project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box

#let defaults = (
  bodyFont: "Libre Baskerville",
  bodySize: 10.5pt,
  leading: 1.5em,
  headingFont: "Libre Baskerville",
  h1Size: 19pt,
  h2Size: 14pt,
  h3Size: 12pt,
  firstLineIndentMm: 6,
  runningHeaders: false,
  quoteIndentLeftMm: 15,
  quoteIndentRightMm: 15,
  quoteFontSizeEm: 0.9,
)

// Template defaults are merged under whatever the generator passes, so a
// JSON definition or user setting always wins over the template default.
#let project(..args) = base-project(..(defaults + args.named()), ..args.pos())
