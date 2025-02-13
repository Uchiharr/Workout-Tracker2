import { type Workout, type Exercise, type WorkoutHistory, type InsertWorkout, type InsertExercise, type InsertHistory } from "@shared/schema";

export interface IStorage {
  // Workouts
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  updateWorkout(id: number, workout: InsertWorkout): Promise<Workout | undefined>;
  deleteWorkout(id: number): Promise<void>;
  getWorkout(id: number): Promise<Workout | undefined>;
  listWorkouts(): Promise<Workout[]>;

  // Exercises
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  getExercisesForWorkout(workoutId: number): Promise<Exercise[]>;
  deleteExercisesForWorkout(workoutId: number): Promise<void>;

  // History
  addHistory(history: InsertHistory): Promise<WorkoutHistory>;
  getHistoryForExercise(exerciseId: number): Promise<WorkoutHistory[]>;
  getRecentHistory(): Promise<{ id: number; workoutId: number; workoutName: string; completedAt: Date }[]>;

  // Import/Export
  exportData(): Promise<string>;
  importData(jsonData: string): Promise<void>;
}

export class MemoryStorage implements IStorage {
  private workouts: Workout[] = [];
  private exercises: Exercise[] = [];
  private history: WorkoutHistory[] = [];
  private nextId = 1;

  constructor() {
    this.workouts = [];
    this.exercises = [];
    this.history = [];
    this.nextId = 1;
  }

  async createWorkout(workout: InsertWorkout): Promise<Workout> {
    const newWorkout = { ...workout, id: this.nextId++ };
    this.workouts.push(newWorkout);
    return newWorkout;
  }

  async updateWorkout(id: number, workout: InsertWorkout): Promise<Workout | undefined> {
    const index = this.workouts.findIndex(w => w.id === id);
    if (index === -1) return undefined;

    const updatedWorkout = { ...workout, id };
    this.workouts[index] = updatedWorkout;
    return updatedWorkout;
  }

  async deleteWorkout(id: number): Promise<void> {
    this.workouts = this.workouts.filter(w => w.id !== id);
    this.exercises = this.exercises.filter(e => e.workoutId !== id);
  }

  async getWorkout(id: number): Promise<Workout | undefined> {
    return this.workouts.find(w => w.id === id);
  }

  async listWorkouts(): Promise<Workout[]> {
    return this.workouts;
  }

  async createExercise(exercise: InsertExercise): Promise<Exercise> {
    const newExercise = { ...exercise, id: this.nextId++ };
    this.exercises.push(newExercise);
    return newExercise;
  }

  async getExercisesForWorkout(workoutId: number): Promise<Exercise[]> {
    return this.exercises
      .filter(e => e.workoutId === workoutId)
      .sort((a, b) => a.order - b.order);
  }

  async deleteExercisesForWorkout(workoutId: number): Promise<void> {
    this.exercises = this.exercises.filter(e => e.workoutId !== workoutId);
  }

  async addHistory(history: InsertHistory): Promise<WorkoutHistory> {
    const newHistory = { ...history, id: this.nextId++ };
    this.history.push(newHistory);
    return newHistory;
  }

  async getHistoryForExercise(exerciseId: number): Promise<WorkoutHistory[]> {
    return this.history
      .filter(h => h.exerciseId === exerciseId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getRecentHistory(): Promise<{ id: number; workoutId: number; workoutName: string; completedAt: Date }[]> {
    const workoutMap = new Map(this.workouts.map(w => [w.id, w.name]));

    return this.history
      .map(h => ({
        id: h.id,
        workoutId: h.workoutId,
        workoutName: workoutMap.get(h.workoutId) || 'Unknown Workout',
        completedAt: new Date(h.completedAt)
      }))
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, 5);
  }

  async exportData(): Promise<string> {
    return JSON.stringify({
      workouts: this.workouts,
      exercises: this.exercises,
      history: this.history
    }, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      this.workouts = data.workouts || [];
      this.exercises = data.exercises || [];
      this.history = data.history || [];
      this.nextId = Math.max(
        ...this.workouts.map(w => w.id),
        ...this.exercises.map(e => e.id),
        ...this.history.map(h => h.id),
        0
      ) + 1;
    } catch (error) {
      throw new Error('Invalid import data format');
    }
  }
}

export const storage = new MemoryStorage();