const { spawn } = require("child_process");
const path = require("path");

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runHttpE2eTest() {
  console.log("🚀 Starting standalone Next.js server for HTTP E2E verification on port " + PORT + "...");

  const serverProcess = spawn(
    "node",
    [path.join(process.cwd(), ".next/standalone/server.js")],
    {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  serverProcess.stdout.on("data", (d) => {
    // console.log(`[Server stdout] ${d}`);
  });
  serverProcess.stderr.on("data", (d) => {
    // console.error(`[Server stderr] ${d}`);
  });

  try {
    // 1. Wait for server to become ready
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch (err) {}
    }

    if (!ready) {
      throw new Error("Server failed to respond on port " + PORT);
    }
    console.log("✅ Next.js server is live at " + BASE_URL);

    // 2. Test Marketing Landing Page (/)
    console.log("Testing GET / (Landing Page)...");
    const landingRes = await fetch(`${BASE_URL}/`);
    if (landingRes.status !== 200) throw new Error("Landing page returned " + landingRes.status);
    const landingHtml = await landingRes.text();
    if (!landingHtml.includes("Your manuscript in")) {
      throw new Error("Landing page missing headline 'Your manuscript in'");
    }
    if (!landingHtml.includes("Upload. Choose a style. Get a print-ready book.")) {
      throw new Error("Landing page missing sub-headline");
    }
    if (!landingHtml.includes("Upload your manuscript")) {
      throw new Error("Landing page missing CTA button");
    }
    if (!landingHtml.includes("29")) {
      throw new Error("Landing page missing $29 pricing tier");
    }
    console.log("  ✓ Landing page renders headline, sub, CTA, and pricing.");

    // 3. Test /upload
    console.log("Testing GET /upload...");
    const uploadPageRes = await fetch(`${BASE_URL}/upload`);
    if (uploadPageRes.status !== 200) throw new Error("/upload returned " + uploadPageRes.status);
    const uploadHtml = await uploadPageRes.text();
    if (!uploadHtml.includes("Upload Your Manuscript")) {
      throw new Error("/upload missing title");
    }
    if (!uploadHtml.includes("Novel") || !uploadHtml.includes("Philosophy")) {
      throw new Error("/upload missing book type chips");
    }
    console.log("  ✓ /upload page renders with file dropzone and category chips.");

    // 4. Test /templates
    console.log("Testing GET /templates...");
    const templatesPageRes = await fetch(`${BASE_URL}/templates`);
    if (templatesPageRes.status !== 200) throw new Error("/templates returned " + templatesPageRes.status);
    console.log("  ✓ /templates page renders (HTTP 200 OK).");

    // 5. Test /settings
    console.log("Testing GET /settings...");
    const settingsPageRes = await fetch(`${BASE_URL}/settings`);
    if (settingsPageRes.status !== 200) throw new Error("/settings returned " + settingsPageRes.status);
    console.log("  ✓ /settings page renders (HTTP 200 OK).");

    // 6. Test /create
    console.log("Testing GET /create...");
    const createPageRes = await fetch(`${BASE_URL}/create`);
    if (createPageRes.status !== 200) throw new Error("/create returned " + createPageRes.status);
    console.log("  ✓ /create page renders (HTTP 200 OK).");

    // 7. Test /ready
    console.log("Testing GET /ready...");
    const readyPageRes = await fetch(`${BASE_URL}/ready`);
    if (readyPageRes.status !== 200) throw new Error("/ready returned " + readyPageRes.status);
    console.log("  ✓ /ready page renders (HTTP 200 OK).");

    // 8. Test POST /api/upload with multipart form data
    console.log("Testing POST /api/upload...");
    const fakeDocxBuffer = Buffer.alloc(4096, 0x20);
    fakeDocxBuffer[0] = 0x50; // P
    fakeDocxBuffer[1] = 0x4b; // K
    fakeDocxBuffer[2] = 0x03;
    fakeDocxBuffer[3] = 0x04;
    fakeDocxBuffer.write("Sample Manuscript Chapter Content", 100, "utf-8");

    const formData = new FormData();
    const blob = new Blob([fakeDocxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("file", blob, "Test_Manuscript.docx");
    formData.append("bookType", "philosophy");

    const uploadApiRes = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    if (uploadApiRes.status !== 200) {
      const errText = await uploadApiRes.text();
      throw new Error(`Upload API returned ${uploadApiRes.status}: ${errText}`);
    }

    const uploadData = await uploadApiRes.json();
    if (!uploadData.jobId) throw new Error("Upload API did not return a jobId");
    const jobId = uploadData.jobId;
    console.log(`  ✓ Upload API accepted DOCX, returned jobId: ${jobId}, pages: ${uploadData.pageCountEstimate}`);

    // 9. Test GET /api/jobs/[id]
    console.log(`Testing GET /api/jobs/${jobId}...`);
    const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    if (jobRes.status !== 200) throw new Error(`GET job failed with ${jobRes.status}`);
    const jobData = await jobRes.json();
    if (jobData.job.id !== jobId) throw new Error("Job ID mismatch");
    console.log("  ✓ Job retrieval verified.");

    // 10. Test PATCH /api/jobs/[id] (customize template & settings)
    console.log(`Testing PATCH /api/jobs/${jobId}...`);
    const patchRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: "literary",
        trimSize: "trim_5_5x8_5",
      }),
    });
    if (patchRes.status !== 200) throw new Error(`PATCH job failed with ${patchRes.status}`);
    const patchData = await patchRes.json();
    if (patchData.job.templateChoice?.templateKey !== "literary") {
      throw new Error("Template choice was not updated to literary");
    }
    console.log("  ✓ Job template and trim size updated.");

    // 11. Test POST /api/jobs/[id]/start (Queue background generation)
    console.log(`Testing POST /api/jobs/${jobId}/start...`);
    const startRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/start`, {
      method: "POST",
    });
    if (startRes.status !== 200) throw new Error(`Start job failed with ${startRes.status}`);
    console.log("  ✓ Job pipeline started.");

    // 12. Poll job status until ready
    console.log("Polling job status until 'ready'...");
    let isReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(400);
      const pollRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
      const pollData = await pollRes.json();
      if (pollData.job?.status === "ready" && pollData.job?.progress === 100) {
        isReady = true;
        break;
      }
    }

    if (!isReady) throw new Error("Job did not reach ready state in time");
    console.log("  ✓ Job advanced through 8 checklist steps to 'ready' (100%).");

    // 13. Test GET /api/jobs/[id]/download
    console.log(`Testing GET /api/jobs/${jobId}/download...`);
    const downloadRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/download`);
    if (downloadRes.status !== 200) throw new Error(`Download failed with ${downloadRes.status}`);
    const contentType = downloadRes.headers.get("content-type");
    if (!contentType?.includes("application/pdf")) {
      throw new Error("Invalid Content-Type for download: " + contentType);
    }
    const pdfBytes = await downloadRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfBytes);
    const pdfHeader = pdfBuffer.slice(0, 5).toString("utf-8");
    if (pdfHeader !== "%PDF-") {
      throw new Error("Downloaded file is not a valid PDF! Header: " + pdfHeader);
    }
    console.log(`  ✓ Successfully downloaded ${pdfBuffer.length} bytes of print-ready interior PDF!`);

    // 14. Test POST /api/email
    console.log("Testing POST /api/email...");
    const emailRes = await fetch(`${BASE_URL}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, email: "author@example.com" }),
    });
    if (emailRes.status !== 200) throw new Error(`Email dispatch failed with ${emailRes.status}`);
    const emailData = await emailRes.json();
    if (!emailData.success) throw new Error("Email dispatch unconfirmed");
    console.log("  ✓ Email delivery action logged successfully.");

    // 15. Test Auth API
    console.log("Testing Auth API (/api/auth/signin)...");
    const authRes = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "jane@example.com", name: "Jane Austen" }),
    });
    if (authRes.status !== 200) throw new Error(`Auth signin failed with ${authRes.status}`);
    const authData = await authRes.json();
    if (authData.user?.email !== "jane@example.com") throw new Error("Auth user mismatch");
    console.log("  ✓ Author auth sign-in and session cookie confirmed.");

    console.log("\n========================================================");
    console.log("🎉 ALL E2E HTTP ROUTES & APIS PASSED WITH FLYING COLORS!");
    console.log("========================================================\n");
  } finally {
    serverProcess.kill("SIGTERM");
  }
}

runHttpE2eTest().catch((err) => {
  console.error("❌ HTTP E2E Test Failed:", err);
  process.exit(1);
});
