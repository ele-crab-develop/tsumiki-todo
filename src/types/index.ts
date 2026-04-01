export interface Task {
  id: string;
  title: string;
  hours: number; // 0.5 ~ 4
  color: string;
  completed: boolean;
  // physics position (persisted so blocks restore to same spot)
  x: number;
  y: number;
  angle: number;
}

export interface DayData {
  date: string; // YYYY-MM-DD
  tasks: Task[];
}
