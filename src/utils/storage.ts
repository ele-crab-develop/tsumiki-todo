import type { Task } from '../types';

const STORAGE_KEY = 'tsumiki-todo-tasks';

function readAll(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export const taskStore = {
  load(): Task[] {
    return readAll();
  },

  add(task: Task): void {
    const tasks = readAll();
    tasks.push(task);
    writeAll(tasks);
  },

  update(id: string, updates: Partial<Omit<Task, 'id'>>): void {
    const tasks = readAll().map((t) => (t.id === id ? { ...t, ...updates } : t));
    writeAll(tasks);
  },

  remove(id: string): void {
    writeAll(readAll().filter((t) => t.id !== id));
  },

  /** Bulk-save positions from physics engine */
  syncPositions(positions: Map<string, { x: number; y: number }>): void {
    const tasks = readAll().map((t) => {
      const p = positions.get(t.id);
      return p ? { ...t, x: p.x, y: p.y } : t;
    });
    writeAll(tasks);
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
