-- Style settings become optional overrides: NULL means "use the template's
-- value". Column defaults previously forced Classic values (bottom-centre
-- folios, 1.35 leading, Classic margins) onto every template. Existing rows
-- keep their stored values; only new rows start empty.
ALTER TABLE "book_settings"
  ALTER COLUMN "fontBody" DROP NOT NULL, ALTER COLUMN "fontBody" DROP DEFAULT,
  ALTER COLUMN "fontHeading" DROP NOT NULL, ALTER COLUMN "fontHeading" DROP DEFAULT,
  ALTER COLUMN "fontSizePt" DROP NOT NULL, ALTER COLUMN "fontSizePt" DROP DEFAULT,
  ALTER COLUMN "lineHeight" DROP NOT NULL, ALTER COLUMN "lineHeight" DROP DEFAULT,
  ALTER COLUMN "marginTopMm" DROP NOT NULL, ALTER COLUMN "marginTopMm" DROP DEFAULT,
  ALTER COLUMN "marginBottomMm" DROP NOT NULL, ALTER COLUMN "marginBottomMm" DROP DEFAULT,
  ALTER COLUMN "marginInsideMm" DROP NOT NULL, ALTER COLUMN "marginInsideMm" DROP DEFAULT,
  ALTER COLUMN "marginOutsideMm" DROP NOT NULL, ALTER COLUMN "marginOutsideMm" DROP DEFAULT,
  ALTER COLUMN "pageNumbers" DROP NOT NULL, ALTER COLUMN "pageNumbers" DROP DEFAULT,
  ALTER COLUMN "runningHeaders" DROP NOT NULL, ALTER COLUMN "runningHeaders" DROP DEFAULT,
  ALTER COLUMN "chapterOpenRecto" DROP NOT NULL, ALTER COLUMN "chapterOpenRecto" DROP DEFAULT;
