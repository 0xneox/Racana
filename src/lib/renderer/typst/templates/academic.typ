// Academic template — compact leading, sans-serif headings, outer folios.
#import "classic.typ": base-project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box

#let defaults = (
  bodyFont: "Source Serif 4",
  bodySize: 10.5pt,
  leading: 1.3em,
  headingFont: "Source Sans 3",
  h1Size: 18pt,
  h2Size: 14pt,
  h3Size: 12pt,
  pageNumbers: "outer_header",
  firstLineIndentMm: 4.5,
  paragraphSpacingMm: 1.5,
  quoteIndentLeftMm: 12,
  quoteIndentRightMm: 12,
  quoteFontSizeEm: 0.9,
  chapterStyle: "modern",
)

// Template defaults are merged under whatever the generator passes, so a
// JSON definition or user setting always wins over the template default.
#let project(..args) = base-project(..(defaults + args.named()), ..args.pos())
