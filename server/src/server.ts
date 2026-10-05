import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { AppError, badRequest } from "./errors.js";
import { config } from "./env.js";
import { reviewPullRequest } from "./review.js";

const app = express();
app.disable("x-powered-by");
app.use(
  cors(config.clientOrigin ? { origin: config.clientOrigin } : {}),
);
app.use(express.json({ limit: "64kb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "prlens",
    jevConfigured: Boolean(config.typesafeApiKey),
    githubConfigured: Boolean(config.githubToken),
  });
});

app.post("/api/review", async (req: Request, res: Response) => {
  const { prUrl } = (req.body ?? {}) as { prUrl?: unknown };
  if (typeof prUrl !== "string" || prUrl.trim() === "") {
    throw badRequest('The request body must include "prUrl".', "MISSING_PR_URL");
  }
  const response = await reviewPullRequest(prUrl);
  res.json(response);
});

// ---------------------------------------------------------------------------
// Static client (production build)
// ---------------------------------------------------------------------------

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDist = join(currentDir, "../../client/dist");

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(join(clientDist, "index.html"));
    } else {
      next();
    }
  });
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.use((req: Request, res: Response, next: NextFunction) => {
  const accepts = (req.headers.accept ?? "").includes("html");
  if (accepts && req.method === "GET" && !req.path.startsWith("/api")) {
    res
      .status(404)
      .send("Not found — build the client (npm run build -w client) for the web UI, or use /api/review.");
  } else {
    next();
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON request body.", code: "BAD_JSON" });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[prlens] unhandled error:", err);
  res.status(500).json({ error: message, code: "INTERNAL_ERROR" });
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

app.listen(config.port, () => {
  console.log(`[prlens] server listening on http://localhost:${config.port}`);
  if (!config.typesafeApiKey) {
    console.warn(
      "[prlens] TYPESAFE_API_KEY is not set. Reviews will fail until you add it to server/.env (see server/.env.example).",
    );
  }
  if (!config.githubToken) {
    console.warn(
      "[prlens] GITHUB_TOKEN is not set. Using the anonymous GitHub API limit (60 req/hour). " +
        "Add a token to server/.env for higher limits and private repos.",
    );
  }
});