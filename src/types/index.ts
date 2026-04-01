export interface Task {
  id: string;
  title: string;
  hours: number; // 0.5 ~ 4
  color: string;
  completed: boolean;
  x: number;
  y: number;
}
