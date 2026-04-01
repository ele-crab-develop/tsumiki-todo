import { useState } from 'react';
import type { Task } from '../types';

interface Props {
  task: Task | null;
  onSave: (title: string, hours: number) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const HOUR_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

export default function TaskPanel({ task, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [hours, setHours] = useState(task?.hours ?? 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), hours);
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="panel-title">{task ? 'タスクを編集' : '新しいタスク'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="panel-field">
            <label htmlFor="task-title">タイトル</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="やること..."
              autoFocus
              maxLength={30}
            />
          </div>

          <div className="panel-field">
            <label>時間</label>
            <div className="hour-selector">
              {HOUR_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`hour-btn ${hours === h ? 'active' : ''}`}
                  onClick={() => setHours(h)}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div className="panel-actions">
            {onDelete && (
              <button type="button" className="btn-delete" onClick={onDelete}>
                削除
              </button>
            )}
            <button type="button" className="btn-cancel" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn-save" disabled={!title.trim()}>
              {task ? '更新' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
