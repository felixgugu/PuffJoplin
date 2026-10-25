import { describe, expect, it } from 'vitest';
import {
  cancelTodo,
  convertToTodo,
  nextTodoState,
  todoActionLabel,
  todoDueDateValue,
  todoDueFromDateValue,
  todoDueClassName,
  todoDueLabel,
  todoDueTone,
} from './noteTodo';

describe('single todo action', () => {
  it('converts a normal note into an incomplete todo', () => {
    const note = { isTodo: false, todoDue: 0, todoCompleted: 0 };
    expect(todoActionLabel(note)).toBe('轉為待辦');
    expect(nextTodoState(note, 123)).toEqual({ isTodo: true, todoCompleted: 0 });
  });

  it('cycles an incomplete todo through completed and back', () => {
    const incomplete = { isTodo: true, todoDue: 0, todoCompleted: 0 };
    expect(todoActionLabel(incomplete)).toBe('標記完成');
    expect(nextTodoState(incomplete, 123)).toEqual({ todoCompleted: 123 });

    const completed = { isTodo: true, todoDue: 0, todoCompleted: 123 };
    expect(todoActionLabel(completed)).toBe('標記未完成');
    expect(nextTodoState(completed, 456)).toEqual({ todoCompleted: 0 });
  });

  it('converts and cancels todos without losing unrelated state', () => {
    expect(convertToTodo()).toEqual({ isTodo: true, todoDue: 0, todoCompleted: 0 });
    expect(cancelTodo()).toEqual({ isTodo: false, todoDue: 0, todoCompleted: 0 });
  });

  it('round-trips due dates at the end of the selected local day', () => {
    const due = todoDueFromDateValue('2026-10-31');
    expect(todoDueDateValue(due)).toBe('2026-10-31');
    expect(todoDueFromDateValue('')).toBe(0);
  });

  it('labels overdue, today, tomorrow and future due dates', () => {
    const now = new Date(2026, 9, 25, 12).getTime();
    expect(todoDueLabel(todoDueFromDateValue('2026-10-23'), now)).toBe('逾期 2 天');
    expect(todoDueLabel(todoDueFromDateValue('2026-10-25'), now)).toBe('今天到期');
    expect(todoDueLabel(todoDueFromDateValue('2026-10-26'), now)).toBe('明天到期');
    expect(todoDueLabel(todoDueFromDateValue('2026-11-03'), now)).toBe('11 月 3 日到期');
  });

  it('classifies due dates for compact card badges', () => {
    const now = new Date(2026, 9, 25, 12).getTime();
    expect(todoDueTone(0, now)).toBe('none');
    expect(todoDueTone(todoDueFromDateValue('2026-10-23'), now)).toBe('overdue');
    expect(todoDueTone(todoDueFromDateValue('2026-10-25'), now)).toBe('today');
    expect(todoDueTone(todoDueFromDateValue('2026-10-26'), now)).toBe('upcoming');
    expect(todoDueClassName(todoDueFromDateValue('2026-10-23'), now)).toBe('is-overdue');
    expect(todoDueClassName(0, now)).toBe('');
  });
});
