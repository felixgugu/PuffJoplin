export interface TodoState {
  isTodo: boolean;
  todoCompleted: number;
}

export function todoActionLabel(note: TodoState): string {
  if (!note.isTodo) return '轉為待辦';
  return note.todoCompleted ? '標記未完成' : '標記完成';
}

export function nextTodoState(note: TodoState, now = Date.now()): Partial<TodoState> {
  if (!note.isTodo) return { isTodo: true, todoCompleted: 0 };
  return { todoCompleted: note.todoCompleted ? 0 : now };
}
