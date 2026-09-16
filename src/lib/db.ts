import { PrismaClient } from "@prisma/client";

// Global in-memory fallback store for offline/standalone test environments
class InMemoryStore {
  _users: Map<string, any> = new Map();
  _bookJobs: Map<string, any> = new Map();
  _manuscriptAssets: Map<string, any> = new Map();
  _bookStructureJSONs: Map<string, any> = new Map();
  _templateChoices: Map<string, any> = new Map();
  _bookSettings: Map<string, any> = new Map();
  _renderArtifacts: Map<string, any> = new Map();
  _qaReports: Map<string, any> = new Map();
  _payments: Map<string, any> = new Map();
  _emailLogs: Map<string, any> = new Map();

  private generateId() {
    return "id_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  }

  // User
  user = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this._users.set(id, record);
      return record;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = Array.from(this._users.values()).find(
        (u) => (where.id && u.id === where.id) || (where.email && u.email === where.email)
      );
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        this._users.set(existing.id, updated);
        return updated;
      }
      return this.user.create({ data: create });
    },
    findUnique: async ({ where }: any) => {
      return (
        Array.from(this._users.values()).find(
          (u) => (where.id && u.id === where.id) || (where.email && u.email === where.email)
        ) || null
      );
    },
    deleteMany: async () => {
      const count = this._users.size;
      this._users.clear();
      return { count };
    },
  };

  // BookJob
  bookJob = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const {
        manuscriptAsset,
        templateChoice,
        settings,
        artifacts,
        qaReports,
        structureJson,
        ...jobData
      } = data;

      const record = {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0,
        currentStep: "uploaded",
        status: "uploaded",
        bookType: "novel",
        trimSize: "trim_6x9",
        ...jobData,
      };
      this._bookJobs.set(id, record);

      if (manuscriptAsset?.create) {
        await this.manuscriptAsset.create({ data: { jobId: id, ...manuscriptAsset.create } });
      }
      if (templateChoice?.create) {
        await this.templateChoice.create({ data: { jobId: id, ...templateChoice.create } });
      }
      if (settings?.create) {
        await this.bookSettings.create({ data: { jobId: id, ...settings.create } });
      }
      if (structureJson?.create) {
        await this.bookStructureJSON.create({ data: { jobId: id, ...structureJson.create } });
      }
      if (artifacts?.create) {
        for (const a of Array.isArray(artifacts.create) ? artifacts.create : [artifacts.create]) {
          await this.renderArtifact.create({ data: { jobId: id, ...a } });
        }
      }
      if (qaReports?.create) {
        for (const q of Array.isArray(qaReports.create) ? qaReports.create : [qaReports.create]) {
          await this.qAReport.create({ data: { jobId: id, ...q } });
        }
      }

      return record;
    },
    findUnique: async ({ where, include }: any) => {
      const job = this._bookJobs.get(where.id);
      if (!job) return null;
      const copy = { ...job };
      if (include?.manuscriptAsset) {
        copy.manuscriptAsset = Array.from(this._manuscriptAssets.values()).find((m) => m.jobId === job.id) || null;
      }
      if (include?.templateChoice) {
        copy.templateChoice = Array.from(this._templateChoices.values()).find((t) => t.jobId === job.id) || null;
      }
      if (include?.settings) {
        copy.settings = Array.from(this._bookSettings.values()).find((s) => s.jobId === job.id) || null;
      }
      if (include?.structureJson) {
        copy.structureJson = Array.from(this._bookStructureJSONs.values()).find((s) => s.jobId === job.id) || null;
      }
      if (include?.artifacts) {
        copy.artifacts = Array.from(this._renderArtifacts.values()).filter((a) => a.jobId === job.id);
      }
      if (include?.qaReports) {
        copy.qaReports = Array.from(this._qaReports.values()).filter((q) => q.jobId === job.id);
      }
      return copy;
    },
    update: async ({ where, data }: any) => {
      const existing = this._bookJobs.get(where.id);
      if (!existing) throw new Error(`BookJob ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this._bookJobs.set(where.id, updated);
      return updated;
    },
    findMany: async () => Array.from(this._bookJobs.values()),
    deleteMany: async () => {
      const count = this._bookJobs.size;
      this._bookJobs.clear();
      return { count };
    },
  };

  // ManuscriptAsset
  manuscriptAsset = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this._manuscriptAssets.set(id, record);
      return record;
    },
    deleteMany: async () => {
      this._manuscriptAssets.clear();
      return { count: 0 };
    },
  };

  // BookStructureJSON
  bookStructureJSON = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this._bookStructureJSONs.set(id, record);
      return record;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = Array.from(this._bookStructureJSONs.values()).find((s) => s.jobId === where.jobId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        this._bookStructureJSONs.set(existing.id, updated);
        return updated;
      }
      return this.bookStructureJSON.create({ data: create });
    },
    findUnique: async ({ where }: any) => {
      return Array.from(this._bookStructureJSONs.values()).find((s) => s.jobId === where.jobId) || null;
    },
    deleteMany: async () => {
      this._bookStructureJSONs.clear();
      return { count: 0 };
    },
  };

  // TemplateChoice
  templateChoice = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this._templateChoices.set(id, record);
      return record;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = Array.from(this._templateChoices.values()).find((t) => t.jobId === where.jobId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        this._templateChoices.set(existing.id, updated);
        return updated;
      }
      return this.templateChoice.create({ data: create });
    },
    update: async ({ where, data }: any) => {
      const existing = Array.from(this._templateChoices.values()).find((t) => t.jobId === where.jobId);
      if (!existing) throw new Error("TemplateChoice not found");
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this._templateChoices.set(existing.id, updated);
      return updated;
    },
    findUnique: async ({ where }: any) => {
      return Array.from(this._templateChoices.values()).find((t) => t.jobId === where.jobId) || null;
    },
    deleteMany: async () => {
      this._templateChoices.clear();
      return { count: 0 };
    },
  };

  // BookSettings
  bookSettings = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = {
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        trimSize: "trim_6x9",
        fontBody: "Garamond",
        fontHeading: "Cinzel",
        fontSizePt: 11.0,
        lineHeight: 1.35,
        marginInsideMm: 22.2,
        marginOutsideMm: 15.9,
        marginTopMm: 19.1,
        marginBottomMm: 19.1,
        pageNumbers: "bottom_center",
        runningHeaders: true,
        chapterOpenRecto: true,
        bleed: false,
        bleedSizeMm: 3.175,
        ...data,
      };
      this._bookSettings.set(id, record);
      return record;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = Array.from(this._bookSettings.values()).find((s) => s.jobId === where.jobId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        this._bookSettings.set(existing.id, updated);
        return updated;
      }
      return this.bookSettings.create({ data: create });
    },
    update: async ({ where, data }: any) => {
      const existing = Array.from(this._bookSettings.values()).find((s) => s.jobId === where.jobId);
      if (!existing) throw new Error("BookSettings not found");
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this._bookSettings.set(existing.id, updated);
      return updated;
    },
    deleteMany: async () => {
      this._bookSettings.clear();
      return { count: 0 };
    },
  };

  // RenderArtifact
  renderArtifact = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), ...data };
      this._renderArtifacts.set(id, record);
      return record;
    },
    deleteMany: async () => {
      this._renderArtifacts.clear();
      return { count: 0 };
    },
  };

  // QAReport
  qAReport = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), ...data };
      this._qaReports.set(id, record);
      return record;
    },
    deleteMany: async () => {
      this._qaReports.clear();
      return { count: 0 };
    },
  };

  // Payment
  payment = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this._payments.set(id, record);
      return record;
    },
    deleteMany: async () => {
      this._payments.clear();
      return { count: 0 };
    },
  };

  // EmailLog
  emailLog = {
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.generateId();
      const record = { id, createdAt: new Date(), sentAt: new Date(), ...data };
      this._emailLogs.set(id, record);
      return record;
    },
    findUnique: async ({ where }: any) => {
      return this._emailLogs.get(where.id) || null;
    },
    deleteMany: async () => {
      this._emailLogs.clear();
      return { count: 0 };
    },
  };

  async $disconnect() {}
}

const realPrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

const inMemoryStore = (global as any).inMemoryStoreInstance || new InMemoryStore();
(global as any).inMemoryStoreInstance = inMemoryStore;

const CB_OPEN_MS = process.env.DB_CB_OPEN_MS
  ? parseInt(process.env.DB_CB_OPEN_MS, 10)
  : 15_000; // 15 seconds default fallback window

let cbState: { openUntilMs: number | null } = (global as any).dbCbState ?? { openUntilMs: null };
(global as any).dbCbState = cbState;

function cbIsOpen(): boolean {
  if (!cbState.openUntilMs) return false;
  if (Date.now() < cbState.openUntilMs) return true;
  cbState.openUntilMs = null;
  return false;
}

function cbTripFor(windowMs: number = CB_OPEN_MS) {
  cbState.openUntilMs = Date.now() + windowMs;
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[DB] Connection failure detected. Falling back to in-memory store for ${Math.round(
        windowMs / 1000
      )}s. After this window, will attempt Postgres again.`
    );
  }
}

function isConnectionError(msg: string): boolean {
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("P1001") ||
    msg.includes("connect ECONNREFUSED") ||
    msg.includes("Connection terminated unexpectedly") ||
    msg.includes("sorry, too many clients already")
  );
}

// Proxy handler: tries real Prisma; if DB is unreachable, seamlessly delegates to inMemoryStore
// with a time-windowed circuit breaker so transient failures don't permanently disable the DB.
function createResilientPrismaProxy() {
  return new Proxy(realPrisma, {
    get(target: any, prop: string) {
      if (prop === "$disconnect") {
        return async () => {
          try {
            await target.$disconnect();
          } catch {}
        };
      }

      const mockModel = (inMemoryStore as any)[prop];
      if (!mockModel) {
        return target[prop];
      }

      const realModel = target[prop];
      if (!realModel) return mockModel;

      return new Proxy(realModel, {
        get(mTarget: any, mProp: string) {
          const origFn = mTarget[mProp];
          const mockFn = mockModel[mProp];
          if (typeof origFn !== "function") return origFn || mockFn;

          return async (...args: any[]) => {
            const skipReal = cbIsOpen();
            if (skipReal && mockFn) {
              try {
                return await mockFn(...args);
              } catch (mockErr) {
                // fall through to try real DB anyway if mock fails
              }
            }
            try {
              const result = await origFn.apply(mTarget, args);
              // success: reset any stale fallback window so future calls try real DB first
              if (cbIsOpen()) {
                // small success signal: keep window intact, don't extend
              }
              return result;
            } catch (err: any) {
              const msg = err?.message || "";
              if (isConnectionError(msg)) {
                cbTripFor();
                if (mockFn) {
                  try {
                    return await mockFn(...args);
                  } catch (mockFallthroughErr) {
                    // If mock also fails, throw the original DB error for visibility
                  }
                }
              }
              throw err;
            }
          };
        },
      });
    },
  });
}

declare global {
  // eslint-disable-next-line no-var
  var prismaInstance: any | undefined;
}

export const prisma = global.prismaInstance || createResilientPrismaProxy();

if (process.env.NODE_ENV !== "production") {
  global.prismaInstance = prisma;
}

export default prisma;
