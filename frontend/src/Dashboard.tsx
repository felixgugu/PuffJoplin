import type { CSSProperties } from 'react';
import { formatResourceBytes } from './resourceCleanup';
import { todoDueLabel, todoDueTone } from './noteTodo';
import type {
  DashboardSnapshot,
  DashboardTodo,
  View,
} from './types';
import UiIcon from './UiIcon';

interface DashboardProps {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string;
  cleaningResources: boolean;
  onRefresh: () => void;
  onOpenNote: (noteId: string) => void;
  onOpenView: (view: View) => void;
  onCompleteTodo: (noteId: string, todoDue: number) => void;
  onCleanupResources: () => void;
  onOpenDataFolder: () => void;
}

function formatUpdatedAt(value: number): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function activityMaximum(snapshot: DashboardSnapshot): number {
  return Math.max(
    1,
    ...snapshot.activity.map((day) => Math.max(day.created, day.updated)),
  );
}

function TodoRow({
  item,
  onOpen,
  onComplete,
}: {
  item: DashboardTodo;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const tone = todoDueTone(item.todoDue);
  return (
    <div className={`dashboard-todo-row ${tone}`}>
      <button
        type="button"
        className="dashboard-todo-check"
        aria-label={`完成 ${item.title || '未命名筆記'}`}
        title="標記完成"
        onClick={onComplete}
      >
        <UiIcon name="todo-checkbox" />
      </button>
      <button type="button" className="dashboard-row-main" onClick={onOpen}>
        <strong>{item.title || '未命名筆記'}</strong>
        <span>{item.notebookTitle}</span>
      </button>
      {item.todoDue > 0 && (
        <span className={`todo-due-badge ${tone === 'overdue' ? 'is-overdue' : tone === 'today' ? 'is-today' : 'is-upcoming'}`}>
          {todoDueLabel(item.todoDue)}
        </span>
      )}
    </div>
  );
}

export default function Dashboard({
  snapshot,
  loading,
  error,
  cleaningResources,
  onRefresh,
  onOpenNote,
  onOpenView,
  onCompleteTodo,
  onCleanupResources,
  onOpenDataFolder,
}: DashboardProps) {
  if (!snapshot && loading) {
    return (
      <section className="dashboard-panel">
        <div className="dashboard-loading" role="status">
          <span className="loader"><span /></span>
          <strong>正在整理工作台…</strong>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="dashboard-panel">
        <div className="dashboard-loading is-error" role="alert">
          <strong>無法載入儀錶板</strong>
          <span>{error || '未知錯誤'}</span>
          <button type="button" className="primary" onClick={onRefresh}>重試</button>
        </div>
      </section>
    );
  }

  const overdue = snapshot.todos.filter((item) => todoDueTone(item.todoDue) === 'overdue');
  const today = snapshot.todos.filter((item) => todoDueTone(item.todoDue) === 'today');
  const future = snapshot.todos.filter((item) => {
    const tone = todoDueTone(item.todoDue);
    return (tone === 'upcoming' && item.todoDue <= Date.now() + 7 * 86_400_000) || tone === 'none';
  });
  const later = snapshot.todos.filter((item) =>
    todoDueTone(item.todoDue) === 'upcoming' &&
    item.todoDue > Date.now() + 7 * 86_400_000);
  const activityMax = activityMaximum(snapshot);
  const totalActivity = snapshot.activity.reduce(
    (sum, day) => sum + day.created + day.updated,
    0,
  );

  return (
    <section className="dashboard-panel" aria-label="儀錶板">
      <header className="dashboard-hero">
        <div>
          <span className="eyebrow">PuffJoplin 工作台</span>
          <h2>儀錶板</h2>
          <p>快速掌握待辦、最近筆記與本機資料健康。</p>
        </div>
        <button
          type="button"
          className="dashboard-refresh"
          disabled={loading}
          onClick={onRefresh}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M15.75 6.25V2.5m0 0H12m3.75 0-2.4 2.4A6 6 0 1 0 16 12" />
          </svg>
          {loading ? '更新中…' : '重新整理'}
        </button>
      </header>

      {error && <div className="dashboard-inline-error" role="alert">{error}</div>}

      <div className="dashboard-stat-grid">
        <button type="button" className="dashboard-stat-card" onClick={() => onOpenView({ kind: 'all' })}>
          <span className="dashboard-stat-icon"><UiIcon name="all-notes" /></span>
          <strong>{snapshot.counts.activeNotes}</strong>
          <span>全部筆記</span>
        </button>
        <button type="button" className="dashboard-stat-card" onClick={() => onOpenView({ kind: 'todo' })}>
          <span className="dashboard-stat-icon"><UiIcon name="todo" /></span>
          <strong>{snapshot.counts.openTodos}</strong>
          <span>未完成待辦</span>
          <small>{snapshot.counts.completedTodos} 篇已完成</small>
        </button>
        <button type="button" className="dashboard-stat-card" onClick={() => onOpenView({ kind: 'all' })}>
          <span className="dashboard-stat-icon"><UiIcon name="folder" /></span>
          <strong>{snapshot.counts.notebooks}</strong>
          <span>筆記本</span>
        </button>
        <button type="button" className="dashboard-stat-card" onClick={() => onOpenView({ kind: 'trash' })}>
          <span className="dashboard-stat-icon"><UiIcon name="trash" /></span>
          <strong>{snapshot.counts.trashNotes}</strong>
          <span>垃圾桶</span>
        </button>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card dashboard-recent">
          <header>
            <div><span className="eyebrow">最近</span><h3>最近編輯</h3></div>
            <button type="button" onClick={() => onOpenView({ kind: 'all' })}>全部筆記</button>
          </header>
          <div className="dashboard-list">
            {snapshot.recent.map((note) => (
              <button type="button" key={note.id} onClick={() => onOpenNote(note.id)}>
                <span className="dashboard-list-icon"><UiIcon name="all-notes" /></span>
                <span>
                  <strong>{note.title || '未命名筆記'}</strong>
                  <small>{note.notebookTitle}</small>
                </span>
                <time>{formatUpdatedAt(note.updatedAt)}</time>
              </button>
            ))}
            {snapshot.recent.length === 0 && <p className="dashboard-empty">尚無筆記。</p>}
          </div>
        </article>

        <article className="dashboard-card dashboard-focus">
          <header>
            <div><span className="eyebrow">今日焦點</span><h3>待辦與到期提醒</h3></div>
            <button type="button" onClick={() => onOpenView({ kind: 'todo' })}>查看全部</button>
          </header>
          {snapshot.todos.length === 0 ? (
            <p className="dashboard-empty">目前沒有未完成待辦。</p>
          ) : (
            <div className="dashboard-todo-groups">
              {overdue.length > 0 && (
                <section>
                  <h4>逾期 <span>{overdue.length}</span></h4>
                  {overdue.slice(0, 4).map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      onOpen={() => onOpenNote(item.id)}
                      onComplete={() => onCompleteTodo(item.id, item.todoDue)}
                    />
                  ))}
                </section>
              )}
              {today.length > 0 && (
                <section>
                  <h4>今天到期 <span>{today.length}</span></h4>
                  {today.slice(0, 4).map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      onOpen={() => onOpenNote(item.id)}
                      onComplete={() => onCompleteTodo(item.id, item.todoDue)}
                    />
                  ))}
                </section>
              )}
              {future.length > 0 && (
                <section>
                  <h4>接下來 7 天／未排程 <span>{future.length}</span></h4>
                  {future.slice(0, 4).map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      onOpen={() => onOpenNote(item.id)}
                      onComplete={() => onCompleteTodo(item.id, item.todoDue)}
                    />
                  ))}
                </section>
              )}
              {later.length > 0 && (
                <section>
                  <h4>稍後到期 <span>{later.length}</span></h4>
                  {later.slice(0, 4).map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      onOpen={() => onOpenNote(item.id)}
                      onComplete={() => onCompleteTodo(item.id, item.todoDue)}
                    />
                  ))}
                </section>
              )}
            </div>
          )}
        </article>

        <article className="dashboard-card dashboard-activity">
          <header>
            <div><span className="eyebrow">最近 28 天</span><h3>寫作活動</h3></div>
            <span className="dashboard-card-value">{totalActivity}</span>
          </header>
          <div className="dashboard-activity-chart" aria-label="最近 28 天筆記建立與修改活動">
            {snapshot.activity.map((day) => {
              const total = day.created + day.updated;
              return (
                <div
                  className="dashboard-activity-column"
                  key={day.date}
                  title={`${day.date}：新增 ${day.created}，修改 ${day.updated}`}
                >
                  <span
                    className="dashboard-activity-created"
                    style={{ height: `${Math.max(total > 0 ? 8 : 2, day.created / activityMax * 100)}%` }}
                  />
                  <span
                    className="dashboard-activity-updated"
                    style={{ height: `${Math.max(total > 0 ? 4 : 0, day.updated / activityMax * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="dashboard-activity-legend">
            <span><i className="created" />新增</span>
            <span><i className="updated" />修改</span>
          </div>
        </article>

        <article className="dashboard-card">
          <header>
            <div><span className="eyebrow">分類</span><h3>筆記本分布</h3></div>
          </header>
          <div className="dashboard-bar-list">
            {snapshot.notebooks.map((notebook) => (
              <button
                type="button"
                key={notebook.id}
                onClick={() => onOpenView({ kind: 'notebook', id: notebook.id })}
              >
                <span><UiIcon name={notebook.storageKind === 'directory' ? 'folder-managed' : 'folder'} />{notebook.title}</span>
                <strong>{notebook.noteCount}</strong>
                <i style={{ '--dashboard-bar': `${Math.max(3, notebook.noteCount / Math.max(1, snapshot.counts.activeNotes) * 100)}%` } as CSSProperties} />
                {notebook.openTodoCount > 0 && <small>{notebook.openTodoCount} 待辦</small>}
              </button>
            ))}
            {snapshot.notebooks.length === 0 && <p className="dashboard-empty">尚無筆記本。</p>}
          </div>
        </article>

        <article className="dashboard-card">
          <header>
            <div><span className="eyebrow">標籤</span><h3>常用標籤</h3></div>
            <span className="dashboard-card-value">{snapshot.counts.tags}</span>
          </header>
          <div className="dashboard-tags">
            {snapshot.tags.map((tag) => (
              <button type="button" key={tag.id} onClick={() => onOpenView({ kind: 'tag', id: tag.id })}>
                #{tag.title} <span>{tag.count}</span>
              </button>
            ))}
            {snapshot.tags.length === 0 && <p className="dashboard-empty">尚無標籤。</p>}
          </div>
        </article>

        <article className="dashboard-card dashboard-media">
          <header>
            <div><span className="eyebrow">儲存</span><h3>媒體與附件</h3></div>
          </header>
          <div className="dashboard-metric-grid">
            <div><strong>{snapshot.media.imageReferences}</strong><span>圖片引用</span></div>
            <div><strong>{snapshot.media.mermaidDiagrams}</strong><span>Mermaid</span></div>
            <div><strong>{snapshot.media.attachmentCount}</strong><span>附件</span></div>
            <div><strong>{formatResourceBytes(snapshot.media.attachmentBytes)}</strong><span>附件容量</span></div>
          </div>
        </article>

        <article className="dashboard-card dashboard-health">
          <header>
            <div><span className="eyebrow">本機資料</span><h3>資料健康</h3></div>
            <button type="button" onClick={onOpenDataFolder}>開啟資料夾</button>
          </header>
          <div className="dashboard-health-summary">
            <div className={snapshot.media.unusedResourceBytes > 0 ? 'has-warning' : ''}>
              <strong>{formatResourceBytes(snapshot.media.unusedResourceBytes)}</strong>
              <span>可回收資源 · {snapshot.media.unusedResourceCount} 個</span>
            </div>
            <div className={snapshot.media.missingResourceCount > 0 ? 'has-error' : ''}>
              <strong>{snapshot.media.missingResourceCount}</strong>
              <span>遺失附件</span>
            </div>
          </div>
          <p className="dashboard-data-path" title={snapshot.health.dataDir}>
            {snapshot.health.dataDir}
          </p>
          {snapshot.health.managedRoots.map((root) => (
            <div className={`dashboard-managed-root ${root.available ? '' : 'is-error'}`} key={root.notebookId}>
              <span><UiIcon name="folder-managed" />{root.title}</span>
              <small>{root.available ? '可存取' : '無法存取'} · {root.path}</small>
            </div>
          ))}
          <div className="dashboard-health-actions">
            <button
              type="button"
              disabled={cleaningResources || snapshot.media.unusedResourceCount === 0}
              onClick={onCleanupResources}
            >
              {cleaningResources ? '清理中…' : '資源檔清理'}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
