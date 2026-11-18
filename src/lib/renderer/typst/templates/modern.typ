// Modern template — clean, left-aligned chapter openers with an oversized
// numeral, sans-serif headings, block paragraphs, folios in the outer header.
#import "classic.typ": base-project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box

#let defaults = (
  bodyFont: "Source Serif 4",
  bodySize: 11pt,
  leading: 1.4em,
  headingFont: "Source Sans 3",
  h1Size: 22pt,
  h2Size: 15pt,
  h3Size: 12.5pt,
  chapterOpenRecto: false,
  pageNumbers: "outer_header",
  firstLineIndentMm: 0,
  paragraphSpacingMm: 2.5,
  quoteIndentLeftMm: 10,
  quoteIndentRightMm: 10,
  quoteFontSizeEm: 0.92,
  quoteItalic: false,
  runningHeaderFormat: "title_chapter",
  chapterStyle: "modern",
  headingSpaceBeforeMm: 9,
  headingSpaceAfterMm: 3,
)

// Template defaults are merged under whatever the generator passes, so a
// JSON definition or user setting always wins over the template default.
#let project(..args) = base-project(..(defaults + args.named()), ..args.pos())
