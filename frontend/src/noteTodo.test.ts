import { describe, expect, it } from 'vitest';
import { nextTodoState, todoActionLabel } from './noteTodo';

describe('single todo action', () => {
  it('converts a normal note into an incomplete todo', () => {
    const note = { isTodo: false, todoCompleted: 0 };
    expect(todoActionLabel(note)).toBe('轉為待辦');
    expect(nextTodoState(note, 123)).toEqual({ isTodo: true, todoCompleted: 0 });
  });

  it('cycles an incomplete todo through completed and back', () => {
    const incomplete = { isTodo: true, todoCompleted: 0 };
    expect(todoActionLabel(incomplete)).toBe('標記完成');
    expect(nextTodoState(incomplete, 123)).toEqual({ todoCompleted: 123 });

    const completed = { isTodo: true, todoCompleted: 123 };
    expect(todoActionLabel(completed)).toBe('標記未完成');
    expect(nextTodoState(completed, 456)).toEqual({ todoCompleted: 0 });
  });
});
