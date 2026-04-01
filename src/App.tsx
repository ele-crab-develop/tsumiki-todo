import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from './types';
import { usePhysics } from './hooks/usePhysics';
import { taskStore } from './utils/storage';
import { randomColor, GOLD_COLOR } from './utils/colors';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BLOCK_WIDTH,
  LIMIT_LINE_Y,
  GROUND_Y,
  STACKING_LEFT,
  STACKING_RIGHT,
  hoursToHeight,
  stagingX,
  MAX_HOURS,
  PX_PER_HOUR,
} from './utils/constants';
import TaskPanel from './components/TaskPanel';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const physics = usePhysics();
  const worldRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressStart = useRef<number>(0);
  const longPressRaf = useRef<number>(0);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Load tasks on mount
  useEffect(() => {
    const saved = taskStore.load();
    if (saved.length > 0) {
      setTasks(saved);
      saved.forEach((t: Task) => physics.addBlock(t));
    }
  }, []);

  // Sync physics → React at 60fps
  useEffect(() => {
    let raf: number;
    const sync = () => {
      setPositions(physics.getBodyPositions());
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [physics]);

  // Auto-save positions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (tasksRef.current.length > 0) {
        taskStore.syncPositions(physics.getBodyPositions());
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [physics]);

  const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);

  // ---- CRUD ----
  const addTask = useCallback(
    (title: string, hours: number) => {
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        hours,
        color: randomColor(),
        completed: false,
        x: stagingX(tasksRef.current.length),
        y: GROUND_Y - hoursToHeight(hours) / 2 - 4,
      };
      taskStore.add(task);
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
        const updated: Task = { ...existing, title, hours, x: pos?.x ?? existing.x, y: pos?.y ?? existing.y };
        taskStore.update(id, { title, hours, x: updated.x, y: updated.y });
        physics.addBlock(updated);
        return prev.map((t) => (t.id === id ? updated : t));
      });
    },
    [physics]
  );

  const deleteTask = useCallback(
    (id: string) => {
      physics.removeBlock(id);
      taskStore.remove(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [physics]
  );

  const completeTask = useCallback(
    (id: string) => {
      physics.setStatic(id, true);
      taskStore.update(id, { completed: true });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: true } : t)));
    },
    [physics]
  );

  const uncompleteTask = useCallback(
    (id: string) => {
      physics.setStatic(id, false);
      taskStore.update(id, { completed: false });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: false } : t)));
    },
    [physics]
  );

  const resetAll = useCallback(() => {
    physics.removeAll();
    taskStore.clear();
    setTasks([]);
  }, [physics]);

  // ---- Coordinate mapping ----
  // Uses worldRef (the actual world div), not the container.
  // getBoundingClientRect returns screen-space rect, so this handles any CSS scaling.
  const toWorldCoords = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = worldRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    };
  };

  const findTaskAtPoint = (x: number, y: number): Task | undefined => {
    const hitId = physics.queryPoint(x, y);
    if (!hitId) return undefined;
    return tasksRef.current.find((t) => t.id === hitId);
  };

  // ---- Long-press ----
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
    const { x, y } = toWorldCoords(e);
    const task = findTaskAtPoint(x, y);

    if (task) {
      longPressStart.current = Date.now();
      setLongPressId(task.id);
      const animate = () => {
        const progress = Math.min((Date.now() - longPressStart.current) / 800, 1);
        setLongPressProgress(progress);
        if (progress < 1) longPressRaf.current = requestAnimationFrame(animate);
      };
      longPressRaf.current = requestAnimationFrame(animate);

      longPressTimer.current = window.setTimeout(() => {
        task.completed ? uncompleteTask(task.id) : completeTask(task.id);
        cancelLongPress();
      }, 800);
    }

    if (!task?.completed) physics.mouseDown(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = toWorldCoords(e);
    cancelLongPress();
    physics.mouseMove(x, y);
  };

  const handlePointerUp = () => {
    cancelLongPress();
    physics.mouseUp();
    // Save positions after drag
    setTimeout(() => taskStore.syncPositions(physics.getBodyPositions()), 100);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = toWorldCoords(e);
    const task = findTaskAtPoint(x, y);
    if (task && !task.completed) {
      setEditingTask(task);
      setShowPanel(true);
    }
  };

  // ---- Percentage helpers for responsive rendering ----
  const px = (v: number) => `${(v / WORLD_WIDTH) * 100}%`;
  const py = (v: number) => `${(v / WORLD_HEIGHT) * 100}%`;

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
        <div className="side-controls">
          <button className="add-btn" onClick={() => { setEditingTask(null); setShowPanel(true); }}>
            + タスク追加
          </button>
          <div className="task-list">
            {tasks.map((t) => (
              <div key={t.id} className={`task-item ${t.completed ? 'completed' : ''}`}>
                <span className="task-color-dot" style={{ background: t.completed ? GOLD_COLOR : t.color }} />
                <span className="task-name">{t.title}</span>
                <span className="task-hrs">{t.hours}h</span>
                {!t.completed && (
                  <button className="task-delete" onClick={() => deleteTask(t.id)}>×</button>
                )}
              </div>
            ))}
          </div>
          <button className="reset-btn" onClick={resetAll}>
            リセット
          </button>
          <div className="instructions">
            <p>ドラッグで積み木を移動</p>
            <p>長押しで完了/未完了を切替</p>
            <p>ダブルクリックで編集</p>
          </div>
        </div>

        <div
          className="canvas-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{ touchAction: 'none' }}
        >
          <div ref={worldRef} className="canvas-world" style={{ aspectRatio: `${WORLD_WIDTH}/${WORLD_HEIGHT}` }}>
            {/* Left staging zone */}
            <div className="staging-zone staging-left" style={{ width: px(STACKING_LEFT) }}>
              <span className="staging-label">タスク置き場</span>
            </div>
            {/* Right staging zone */}
            <div className="staging-zone staging-right" style={{ width: px(WORLD_WIDTH - STACKING_RIGHT), left: px(STACKING_RIGHT) }}>
              <span className="staging-label">タスク置き場</span>
            </div>

            {/* Stacking area dividers */}
            <div className="stacking-divider" style={{ left: px(STACKING_LEFT) }} />
            <div className="stacking-divider" style={{ left: px(STACKING_RIGHT) }} />

            {/* Limit line (only in stacking area) */}
            <div
              className="limit-line"
              style={{
                top: py(LIMIT_LINE_Y),
                left: px(STACKING_LEFT),
                width: px(STACKING_RIGHT - STACKING_LEFT),
              }}
            >
              <span className="limit-label">{MAX_HOURS}h limit</span>
            </div>

            {/* Hour markers */}
            {Array.from({ length: MAX_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="hour-marker"
                style={{
                  top: py(GROUND_Y - i * PX_PER_HOUR),
                  left: px(STACKING_LEFT),
                  width: px(STACKING_RIGHT - STACKING_LEFT),
                }}
              >
                {i > 0 && i % 2 === 0 && <span className="hour-label">{i}h</span>}
              </div>
            ))}

            {/* Ground */}
            <div className="ground" style={{ top: py(GROUND_Y) }} />

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
                    width: px(BLOCK_WIDTH),
                    height: py(h),
                    left: px(pos.x - BLOCK_WIDTH / 2),
                    top: py(pos.y - h / 2),
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
      </div>

      {showPanel && (
        <TaskPanel
          task={editingTask}
          onSave={(title, hours) => {
            if (editingTask) updateTask(editingTask.id, title, hours);
            else addTask(title, hours);
            setShowPanel(false);
            setEditingTask(null);
          }}
          onDelete={editingTask ? () => { deleteTask(editingTask.id); setShowPanel(false); setEditingTask(null); } : undefined}
          onClose={() => { setShowPanel(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}

export default App;
