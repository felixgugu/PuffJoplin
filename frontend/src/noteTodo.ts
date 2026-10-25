export interface TodoState {
  isTodo: boolean;
  todoDue: number;
  todoCompleted: number;
}

export type TodoDueTone = 'none' | 'overdue' | 'today' | 'upcoming';

const todoDueClassNames: Record<TodoDueTone, string> = {
  none: '',
  overdue: 'is-overdue',
  today: 'is-today',
  upcoming: 'is-upcoming',
};

export function todoActionLabel(note: TodoState): string {
  if (!note.isTodo) return '轉為待辦';
  return note.todoCompleted ? '標記未完成' : '標記完成';
}

export function nextTodoState(note: TodoState, now = Date.now()): Partial<TodoState> {
  if (!note.isTodo) return { isTodo: true, todoCompleted: 0 };
  return { todoCompleted: note.todoCompleted ? 0 : now };
}

export function convertToTodo(): Partial<TodoState> {
  return { isTodo: true, todoDue: 0, todoCompleted: 0 };
}

export function cancelTodo(): Partial<TodoState> {
  return { isTodo: false, todoDue: 0, todoCompleted: 0 };
}

export function todoDueDateValue(todoDue: number): string {
  if (!todoDue) return '';
  const date = new Date(todoDue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todoDueFromDateValue(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return 0;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    23,
    59,
    59,
    999,
  );
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function todoDueLabel(todoDue: number, now = Date.now()): string {
  if (!todoDue) return '';
  const due = new Date(todoDue);
  if (Number.isNaN(due.getTime())) return '';
  const today = new Date(now);
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOffset = Math.round((dueDay - todayDay) / 86_400_000);
  if (dayOffset < 0) return `逾期 ${Math.abs(dayOffset)} 天`;
  if (dayOffset === 0) return '今天到期';
  if (dayOffset === 1) return '明天到期';
  return `${due.getMonth() + 1} 月 ${due.getDate()} 日到期`;
}

export function todoDueTone(todoDue: number, now = Date.now()): TodoDueTone {
  if (!todoDue) return 'none';
  const due = new Date(todoDue);
  if (Number.isNaN(due.getTime())) return 'none';
  const today = new Date(now);
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOffset = Math.round((dueDay - todayDay) / 86_400_000);
  if (dayOffset < 0) return 'overdue';
  if (dayOffset === 0) return 'today';
  return 'upcoming';
}

export function todoDueClassName(todoDue: number, now = Date.now()): string {
  return todoDueClassNames[todoDueTone(todoDue, now)];
}
