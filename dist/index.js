// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemoryStorage = class {
  workouts = [];
  exercises = [];
  history = [];
  nextId = 1;
  constructor() {
    this.loadFromLocalStorage();
  }
  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem("workoutData");
      if (data) {
        const parsed = JSON.parse(data);
        this.workouts = parsed.workouts || [];
        this.exercises = parsed.exercises || [];
        this.history = parsed.history || [];
        this.nextId = Math.max(
          ...this.workouts.map((w) => w.id),
          ...this.exercises.map((e) => e.id),
          ...this.history.map((h) => h.id),
          0
        ) + 1;
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
  }
  saveToLocalStorage() {
    try {
      localStorage.setItem("workoutData", JSON.stringify({
        workouts: this.workouts,
        exercises: this.exercises,
        history: this.history
      }));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }
  async createWorkout(workout) {
    const newWorkout = { ...workout, id: this.nextId++ };
    this.workouts.push(newWorkout);
    this.saveToLocalStorage();
    return newWorkout;
  }
  async updateWorkout(id, workout) {
    const index = this.workouts.findIndex((w) => w.id === id);
    if (index === -1) return void 0;
    const updatedWorkout = { ...workout, id };
    this.workouts[index] = updatedWorkout;
    this.saveToLocalStorage();
    return updatedWorkout;
  }
  async deleteWorkout(id) {
    this.workouts = this.workouts.filter((w) => w.id !== id);
    this.exercises = this.exercises.filter((e) => e.workoutId !== id);
    this.saveToLocalStorage();
  }
  async getWorkout(id) {
    return this.workouts.find((w) => w.id === id);
  }
  async listWorkouts() {
    return this.workouts;
  }
  async createExercise(exercise) {
    const newExercise = { ...exercise, id: this.nextId++ };
    this.exercises.push(newExercise);
    this.saveToLocalStorage();
    return newExercise;
  }
  async getExercisesForWorkout(workoutId) {
    return this.exercises.filter((e) => e.workoutId === workoutId).sort((a, b) => a.order - b.order);
  }
  async deleteExercisesForWorkout(workoutId) {
    this.exercises = this.exercises.filter((e) => e.workoutId !== workoutId);
    this.saveToLocalStorage();
  }
  async addHistory(history) {
    const newHistory = { ...history, id: this.nextId++ };
    this.history.push(newHistory);
    this.saveToLocalStorage();
    return newHistory;
  }
  async getHistoryForExercise(exerciseId) {
    return this.history.filter((h) => h.exerciseId === exerciseId).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }
  async getRecentHistory() {
    const workoutMap = new Map(this.workouts.map((w) => [w.id, w.name]));
    return this.history.map((h) => ({
      id: h.id,
      workoutId: h.workoutId,
      workoutName: workoutMap.get(h.workoutId) || "Unknown Workout",
      completedAt: new Date(h.completedAt)
    })).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()).slice(0, 5);
  }
  async exportData() {
    return JSON.stringify({
      workouts: this.workouts,
      exercises: this.exercises,
      history: this.history
    }, null, 2);
  }
  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      this.workouts = data.workouts || [];
      this.exercises = data.exercises || [];
      this.history = data.history || [];
      this.nextId = Math.max(
        ...this.workouts.map((w) => w.id),
        ...this.exercises.map((e) => e.id),
        ...this.history.map((h) => h.id),
        0
      ) + 1;
      this.saveToLocalStorage();
    } catch (error) {
      throw new Error("Invalid import data format");
    }
  }
};
var storage = new MemoryStorage();

// shared/schema.ts
import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull()
});
var exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull(),
  name: text("name").notNull(),
  sets: integer("sets").notNull(),
  reps: integer("reps").notNull(),
  order: integer("order").notNull()
});
var workoutHistory = pgTable("workout_history", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull(),
  exerciseId: integer("exercise_id").notNull(),
  weight: integer("weight").notNull(),
  unit: text("unit").notNull().$type().default("lb"),
  completedAt: timestamp("completed_at").notNull()
});
var insertWorkoutSchema = createInsertSchema(workouts);
var insertExerciseSchema = createInsertSchema(exercises).omit({ id: true });
var insertHistorySchema = createInsertSchema(workoutHistory).omit({ id: true });

// server/routes.ts
function registerRoutes(app2) {
  app2.get("/api/workouts", async (_req, res) => {
    const workouts2 = await storage.listWorkouts();
    res.json(workouts2);
  });
  app2.post("/api/workouts", async (req, res) => {
    const parsed = insertWorkoutSchema.parse(req.body);
    const workout = await storage.createWorkout(parsed);
    res.json(workout);
  });
  app2.patch("/api/workouts/:id", async (req, res) => {
    const parsed = insertWorkoutSchema.parse(req.body);
    const workout = await storage.updateWorkout(Number(req.params.id), parsed);
    if (!workout) {
      return res.status(404).json({ message: "Workout not found" });
    }
    res.json(workout);
  });
  app2.delete("/api/workouts/:id", async (req, res) => {
    await storage.deleteWorkout(Number(req.params.id));
    res.status(204).end();
  });
  app2.get("/api/workouts/:id", async (req, res) => {
    const workout = await storage.getWorkout(Number(req.params.id));
    if (!workout) {
      return res.status(404).json({ message: "Workout not found" });
    }
    res.json(workout);
  });
  app2.get("/api/workouts/:id/exercises", async (req, res) => {
    const exercises2 = await storage.getExercisesForWorkout(Number(req.params.id));
    res.json(exercises2);
  });
  app2.post("/api/workouts/:id/exercises", async (req, res) => {
    const parsed = insertExerciseSchema.parse({
      ...req.body,
      workoutId: Number(req.params.id)
    });
    const exercise = await storage.createExercise(parsed);
    res.json(exercise);
  });
  app2.delete("/api/workouts/:id/exercises", async (req, res) => {
    await storage.deleteExercisesForWorkout(Number(req.params.id));
    res.status(204).end();
  });
  app2.get("/api/workouts/:id/history", async (req, res) => {
    const exercises2 = await storage.getExercisesForWorkout(Number(req.params.id));
    const histories = await Promise.all(
      exercises2.map((exercise) => storage.getHistoryForExercise(exercise.id))
    );
    const allHistory = histories.flat();
    res.json(allHistory);
  });
  app2.post("/api/history", async (req, res) => {
    const parsed = insertHistorySchema.parse({
      ...req.body,
      completedAt: /* @__PURE__ */ new Date()
    });
    const history = await storage.addHistory(parsed);
    res.json(history);
  });
  app2.get("/api/exercises/:id/history", async (req, res) => {
    const history = await storage.getHistoryForExercise(Number(req.params.id));
    res.json(history);
  });
  app2.get("/api/history/recent", async (_req, res) => {
    const history = await storage.getRecentHistory();
    res.json(history);
  });
  app2.get("/api/export", async (_req, res) => {
    const data = await storage.exportData();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=workout-data.json");
    res.send(data);
  });
  app2.post("/api/import", async (req, res) => {
    try {
      await storage.importData(JSON.stringify(req.body));
      res.json({ message: "Data imported successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid import data" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const PORT = 5e3;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
