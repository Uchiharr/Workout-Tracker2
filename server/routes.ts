import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSchema, insertExerciseSchema, insertHistorySchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.get("/api/workouts", async (_req, res) => {
    const workouts = await storage.listWorkouts();
    res.json(workouts);
  });

  app.post("/api/workouts", async (req, res) => {
    const parsed = insertWorkoutSchema.parse(req.body);
    const workout = await storage.createWorkout(parsed);
    res.json(workout);
  });

  app.patch("/api/workouts/:id", async (req, res) => {
    const parsed = insertWorkoutSchema.parse(req.body);
    const workout = await storage.updateWorkout(Number(req.params.id), parsed);
    if (!workout) {
      return res.status(404).json({ message: "Workout not found" });
    }
    res.json(workout);
  });

  app.delete("/api/workouts/:id", async (req, res) => {
    await storage.deleteWorkout(Number(req.params.id));
    res.status(204).end();
  });

  app.get("/api/workouts/:id", async (req, res) => {
    const workout = await storage.getWorkout(Number(req.params.id));
    if (!workout) {
      return res.status(404).json({ message: "Workout not found" });
    }
    res.json(workout);
  });

  app.get("/api/workouts/:id/exercises", async (req, res) => {
    const exercises = await storage.getExercisesForWorkout(Number(req.params.id));
    res.json(exercises);
  });

  app.post("/api/workouts/:id/exercises", async (req, res) => {
    const parsed = insertExerciseSchema.parse({
      ...req.body,
      workoutId: Number(req.params.id)
    });
    const exercise = await storage.createExercise(parsed);
    res.json(exercise);
  });

  app.delete("/api/workouts/:id/exercises", async (req, res) => {
    await storage.deleteExercisesForWorkout(Number(req.params.id));
    res.status(204).end();
  });

  app.get("/api/workouts/:id/history", async (req, res) => {
    const exercises = await storage.getExercisesForWorkout(Number(req.params.id));
    const histories = await Promise.all(
      exercises.map(exercise => storage.getHistoryForExercise(exercise.id))
    );
    const allHistory = histories.flat();
    res.json(allHistory);
  });

  app.post("/api/history", async (req, res) => {
    const parsed = insertHistorySchema.parse({
      ...req.body,
      completedAt: new Date()
    });
    const history = await storage.addHistory(parsed);
    res.json(history);
  });

  app.get("/api/exercises/:id/history", async (req, res) => {
    const history = await storage.getHistoryForExercise(Number(req.params.id));
    res.json(history);
  });

  app.get("/api/history/recent", async (_req, res) => {
    const history = await storage.getRecentHistory();
    res.json(history);
  });

  // New routes for import/export functionality
  app.get("/api/export", async (_req, res) => {
    const data = await storage.exportData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=workout-data.json');
    res.send(data);
  });

  app.post("/api/import", async (req, res) => {
    try {
      await storage.importData(JSON.stringify(req.body));
      res.json({ message: "Data imported successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid import data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}