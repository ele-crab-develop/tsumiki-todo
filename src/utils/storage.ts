import type { DayData, Task } from '../types';

const STORAGE_KEY = 'tsumiki-todo-data';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: DayData = JSON.parse(raw);
    if (data.date !== todayKey()) return [];
    return data.tasks;
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  const data: DayData = { date: todayKey(), tasks };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
