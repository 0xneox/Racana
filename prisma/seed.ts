import { PrismaClient, JobStatus, BookType, TemplateKey, TrimSize, SettingsMode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database for 'Manuscript In, Book Out'...");

  // 1. Clean existing records for idempotent runs
  await prisma.emailLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.renderArtifact.deleteMany();
  await prisma.qAReport.deleteMany();
  await prisma.bookSettings.deleteMany();
  await prisma.templateChoice.deleteMany();
  await prisma.bookStructureJSON.deleteMany();
  await prisma.manuscriptAsset.deleteMany();
  await prisma.bookJob.deleteMany();
  await prisma.user.deleteMany();

  // 2. Demo Users
  const demoUser = await prisma.user.create({
    data: {
      email: "author@example.com",
      name: "Jane Austen",
    },
  });
  console.log(`👤 Created demo user: ${demoUser.email} (${demoUser.id})`);

  const demoAuthorUser = await prisma.user.create({
    data: {
      email: "demo@manuscriptinbookout.com",
      name: "Demo Author",
    },
  });
  console.log(`👤 Created demo user: ${demoAuthorUser.email} (${demoAuthorUser.id})`);

  // 3. Ready Demo Book Job (Fully completed pipeline)
  const readyJob = await prisma.bookJob.create({
    data: {
      id: "demo-job-ready-001",
      userId: demoUser.id,
      status: JobStatus.ready,
      progress: 100,
      currentStep: "ready",
      bookType: BookType.novel,
      trimSize: TrimSize.trim_6x9,
      manuscriptAsset: {
        create: {
          fileName: "Pride_and_Prejudice_Manuscript.docx",
          fileSizeBytes: 428912,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          s3Key: "uploads/demo-job-ready-001/Pride_and_Prejudice_Manuscript.docx",
          s3Bucket: "manuscripts",
          pageCountEstimate: 284,
          wordCountEstimate: 122189,
          sha256Checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      },
      structureJson: {
        create: {
          detectedTitle: "Pride and Prejudice",
          detectedAuthor: "Jane Austen",
          chapterCount: 61,
          detectedBookType: BookType.novel,
          structureData: {
            frontmatter: [
              { type: "half_title", title: "Pride and Prejudice" },
              { type: "title_page", title: "Pride and Prejudice", author: "Jane Austen" },
              { type: "copyright", year: 2026, rights: "Public Domain" },
            ],
            chapters: [
              { number: 1, title: "Chapter I", wordCount: 840 },
              { number: 2, title: "Chapter II", wordCount: 790 },
              { number: 3, title: "Chapter III", wordCount: 1650 },
            ],
            backmatter: [{ type: "about_author", title: "About the Author" }],
          },
        },
      },
      templateChoice: {
        create: {
          templateKey: TemplateKey.classic,
          name: "Classic",
          personality: "Timeless Literary",
          description: "Traditional Garamond typography with elegant drop caps and classic running headers.",
        },
      },
      settings: {
        create: {
          trimSize: TrimSize.trim_6x9,
          fontBody: "Garamond",
          fontHeading: "Cinzel",
          fontSizePt: 11.0,
          lineHeight: 1.35,
          marginTopMm: 19.05,
          marginBottomMm: 19.05,
          marginInsideMm: 22.22,
          marginOutsideMm: 15.87,
          pageNumbers: "bottom_center",
          runningHeaders: true,
          chapterOpenRecto: true,
          bleed: false,
          mode: SettingsMode.format_only,
        },
      },
      artifacts: {
        create: [
          {
            artifactType: "interior_pdf",
            s3Key: "artifacts/demo-job-ready-001/interior_print_ready.pdf",
            s3Bucket: "artifacts",
            fileSizeBytes: 1458920,
            downloadUrl: "/api/jobs/demo-job-ready-001/download",
            mimeType: "application/pdf",
          },
        ],
      },
      qaReports: {
        create: [
          {
            score: 99,
            passed: true,
            pageCount: 284,
            issues: [
              {
                code: "INFO_RECTO_BLANK",
                level: "info",
                description: "Clean blank verso inserted before Chapter 1 to ensure recto opening.",
                page: 4,
              },
            ],
          },
        ],
      },
      payments: {
        create: {
          userId: demoUser.id,
          amountCents: 2900,
          currency: "usd",
          status: "paid",
        },
      },
    },
  });
  console.log(`📖 Created ready demo job: ${readyJob.id}`);

  // 4. In-progress Job (Typesetting status)
  const inProgressJob = await prisma.bookJob.create({
    data: {
      id: "demo-job-processing-002",
      userId: demoUser.id,
      status: JobStatus.typesetting,
      progress: 65,
      currentStep: "Layout generated",
      bookType: BookType.philosophy,
      trimSize: TrimSize.trim_5_5x8_5,
      manuscriptAsset: {
        create: {
          fileName: "Meditations_Marcus_Aurelius.docx",
          fileSizeBytes: 312000,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          s3Key: "uploads/demo-job-processing-002/Meditations.docx",
          s3Bucket: "manuscripts",
          pageCountEstimate: 160,
          wordCountEstimate: 48000,
        },
      },
      structureJson: {
        create: {
          detectedTitle: "Meditations",
          detectedAuthor: "Marcus Aurelius",
          chapterCount: 12,
          detectedBookType: BookType.philosophy,
          structureData: {
            frontmatter: [
              { type: "half_title", title: "Meditations" },
              { type: "title_page", title: "Meditations", author: "Marcus Aurelius" },
            ],
            chapters: [
              { number: 1, title: "Book I", wordCount: 2100 },
              { number: 2, title: "Book II", wordCount: 1950 },
              { number: 3, title: "Book III", wordCount: 2400 },
            ],
            backmatter: [],
          },
        },
      },
      templateChoice: {
        create: {
          templateKey: TemplateKey.philosophy,
          name: "Philosophy",
          personality: "Spacious Contemplative",
          description: "Generous margins for contemplative breathing room and subtle section dividers.",
        },
      },
    },
  });
  console.log(`⚙️  Created in-progress job: ${inProgressJob.id}`);

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
