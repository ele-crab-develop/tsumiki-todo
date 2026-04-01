import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from './types';
import { usePhysics } from './hooks/usePhysics';
import { loadTasks, saveTasks } from './utils/storage';
import { randomColor, GOLD_COLOR } from './utils/colors';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BLOCK_WIDTH,
  LIMIT_LINE_Y,
  GROUND_Y,
  STAGING_SHELF_Y,
  STAGING_SPAWN_Y,
  hoursToHeight,
  stagingX,
  MAX_HOURS,
  PX_PER_HOUR,
} from './utils/constants';
import TaskPanel from './components/TaskPanel';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; angle: number }>>(new Map());
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const physics = usePhysics();
  const canvasRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressStart = useRef<number>(0);
  const longPressRaf = useRef<number>(0);
  const isDragging = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Load tasks on mount
  useEffect(() => {
    const saved = loadTasks();
    if (saved.length > 0) {
      setTasks(saved);
      saved.forEach((t) => physics.addBlock(t));
    }
  }, []);

  // Sync physics positions to React at 60fps
  useEffect(() => {
    let raf: number;
    const sync = () => {
      setPositions(physics.getBodyPositions());
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [physics]);

  // Auto-save when tasks change
  useEffect(() => {
    if (tasks.length === 0 && loadTasks().length === 0) return;
    const timeout = setTimeout(() => {
      const pos = physics.getBodyPositions();
      const updated = tasks.map((t) => {
        const p = pos.get(t.id);
        return p ? { ...t, x: p.x, y: p.y, angle: p.angle } : t;
      });
      saveTasks(updated);
    }, 500);
    return () => clearTimeout(timeout);
  }, [tasks, physics]);

  const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);

  const addTask = useCallback(
    (title: string, hours: number) => {
      // Count how many unplaced (non-completed, above shelf) blocks exist for positioning
      const pos = physics.getBodyPositions();
      const stagedCount = tasksRef.current.filter((t) => {
        if (t.completed) return false;
        const p = pos.get(t.id);
        return p && p.y < LIMIT_LINE_Y;
      }).length;

      const task: Task = {
        id: crypto.randomUUID(),
        title,
        hours,
        color: randomColor(),
        completed: false,
        x: stagingX(stagedCount),
        y: STAGING_SPAWN_Y - hoursToHeight(hours) / 2,
        angle: 0,
      };
      physics.addBlock(task);
      setTasks((prev) => [...prev, task]);
    },
    [physics]
  );

  const updateTask = useCallback(
    (id: string, title: string, hours: number) => {
      setTasks((prev) => {
        const existing = prev.find((t) => t.id === id);
        if (!existing) return prev;

        const pos = physics.getBodyPositions().get(id);
        physics.removeBlock(id);
        const updated: Task = {
          ...existing,
          title,
          hours,
          x: pos?.x ?? existing.x,
          y: pos?.y ?? existing.y,
          angle: 0,
        };
        physics.addBlock(updated);
        return prev.map((t) => (t.id === id ? updated : t));
      });
    },
    [physics]
  );

  const deleteTask = useCallback(
    (id: string) => {
      physics.removeBlock(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [physics]
  );

  const completeTask = useCallback(
    (id: string) => {
      physics.setStatic(id, true);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: true } : t))
      );
    },
    [physics]
  );

  const uncompleteTask = useCallback(
    (id: string) => {
      physics.setStatic(id, false);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: false } : t))
      );
    },
    [physics]
  );

  // Pointer handlers
  const getCanvasPos = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = WORLD_WIDTH / rect.width;
    const scaleY = WORLD_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const findTaskAtPoint = (x: number, y: number): Task | undefined => {
    const hitId = physics.queryPoint(x, y);
    if (!hitId) return undefined;
    return tasksRef.current.find((t) => t.id === hitId);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    cancelAnimationFrame(longPressRaf.current);
    setLongPressId(null);
    setLongPressProgress(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getCanvasPos(e);
    isDragging.current = false;

    const task = findTaskAtPoint(x, y);

    if (task) {
      longPressStart.current = Date.now();
      setLongPressId(task.id);

      const animateProgress = () => {
        const elapsed = Date.now() - longPressStart.current;
        const progress = Math.min(elapsed / 800, 1);
        setLongPressProgress(progress);
        if (progress < 1) {
          longPressRaf.current = requestAnimationFrame(animateProgress);
        }
      };
      longPressRaf.current = requestAnimationFrame(animateProgress);

      longPressTimer.current = window.setTimeout(() => {
        if (task.completed) {
          uncompleteTask(task.id);
        } else {
          completeTask(task.id);
        }
        cancelLongPress();
      }, 800);
    }

    if (!task?.completed) {
      physics.mouseDown(x, y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = getCanvasPos(e);
    isDragging.current = true;
    cancelLongPress();
    physics.mouseMove(x, y);
  };

  const handlePointerUp = () => {
    cancelLongPress();
    physics.mouseUp();
    isDragging.current = false;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = getCanvasPos(e);
    const task = findTaskAtPoint(x, y);
    if (task && !task.completed) {
      setEditingTask(task);
      setShowPanel(true);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">つみきTODO</h1>
        <div className="header-info">
          <span className="date">
            {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          </span>
          <span className={`hours-counter ${totalHours > MAX_HOURS ? 'over' : ''}`}>
            {totalHours.toFixed(1)} / {MAX_HOURS}h
          </span>
        </div>
      </header>

      <div className="main-area">
        <div
          className="canvas-container"
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{ touchAction: 'none' }}
        >
          <div className="canvas-world" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}>
            {/* Staging area label */}
            <div className="staging-area" style={{ top: 0, height: STAGING_SHELF_Y }}>
              <span className="staging-label">タスク置き場</span>
            </div>

            {/* Staging shelf line */}
            <div className="shelf-line" style={{ top: STAGING_SHELF_Y }} />

            {/* Limit line */}
            <div className="limit-line" style={{ top: LIMIT_LINE_Y }}>
              <span className="limit-label">{MAX_HOURS}h limit</span>
            </div>

            {/* Hour markers */}
            {Array.from({ length: MAX_HOURS + 1 }, (_, i) => (
              <div key={i} className="hour-marker" style={{ top: GROUND_Y - i * PX_PER_HOUR }}>
                {i > 0 && i % 2 === 0 && <span className="hour-label">{i}h</span>}
              </div>
            ))}

            {/* Ground */}
            <div className="ground" style={{ top: GROUND_Y }} />

            {/* Task blocks */}
            {tasks.map((task) => {
              const pos = positions.get(task.id);
              if (!pos) return null;
              const h = hoursToHeight(task.hours);
              const isLongPressing = longPressId === task.id;

              return (
                <div
                  key={task.id}
                  className={`block ${task.completed ? 'completed' : ''} ${isLongPressing ? 'long-pressing' : ''}`}
                  style={{
                    width: BLOCK_WIDTH,
                    height: h,
                    left: pos.x - BLOCK_WIDTH / 2,
                    top: pos.y - h / 2,
                    transform: `rotate(${pos.angle}rad)`,
                    backgroundColor: task.completed ? GOLD_COLOR : task.color,
                  }}
                >
                  {isLongPressing && (
                    <div
                      className="long-press-overlay"
                      style={{
                        background: task.completed
                          ? `linear-gradient(to right, ${task.color} ${longPressProgress * 100}%, transparent ${longPressProgress * 100}%)`
                          : `linear-gradient(to right, ${GOLD_COLOR}88 ${longPressProgress * 100}%, transparent ${longPressProgress * 100}%)`,
                      }}
                    />
                  )}
                  <div className="block-content">
                    <span className="block-title">{task.title}</span>
                    <span className="block-hours">{task.hours}h</span>
                  </div>
                  {task.completed && <span className="check-mark">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="side-controls">
          <button
            className="add-btn"
            onClick={() => {
              setEditingTask(null);
              setShowPanel(true);
            }}
          >
            + タスク追加
          </button>

          <div className="task-list">
            {tasks.map((t) => (
              <div key={t.id} className={`task-item ${t.completed ? 'completed' : ''}`}>
                <span className="task-color-dot" style={{ background: t.completed ? GOLD_COLOR : t.color }} />
                <span className="task-name">{t.title}</span>
                <span className="task-hrs">{t.hours}h</span>
                {!t.completed && (
                  <button className="task-delete" onClick={() => deleteTask(t.id)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="instructions">
            <p>🖱 ドラッグで積み木を移動</p>
            <p>👆 長押しで完了/未完了を切替</p>
            <p>🖱 ダブルクリックで編集</p>
          </div>
        </div>
      </div>

      {showPanel && (
        <TaskPanel
          task={editingTask}
          onSave={(title, hours) => {
            if (editingTask) {
              updateTask(editingTask.id, title, hours);
            } else {
              addTask(title, hours);
            }
            setShowPanel(false);
            setEditingTask(null);
          }}
          onDelete={
            editingTask
              ? () => {
                  deleteTask(editingTask.id);
                  setShowPanel(false);
                  setEditingTask(null);
                }
              : undefined
          }
          onClose={() => {
            setShowPanel(false);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
