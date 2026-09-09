import { describe, it, expect, beforeEach } from 'vitest';
import { Store, toLocalDate } from '../src/db/store.js';

let store: Store;

beforeEach(() => {
  store = Store.inMemory();
});

describe('Store', () => {
  const topic = {
    title: 'Distributed consensus',
    summary: 'RAFT in a nutshell.',
    resources: ['https://raft.github.io/'],
    estimatedMinutes: 30,
  };

  it('round-trips a session row', () => {
    store.saveSession('2026-08-23', topic);
    const row = store.getSession('2026-08-23')!;
    expect(row.title).toBe('Distributed consensus');
    expect(row.recap_status).toBe('expected');
    expect(JSON.parse(row.resources)).toEqual(['https://raft.github.io/']);
  });

  it('replaces a session on the same date', () => {
    store.saveSession('2026-08-23', topic);
    store.saveSession('2026-08-23', { ...topic, title: 'Secondly' });
    expect(store.allSessions()).toHaveLength(1);
    expect(store.getSession('2026-08-23')!.title).toBe('Secondly');
  });

  it('lists recent titles newest-first', () => {
    store.saveSession('2026-08-21', { ...topic, title: 'A' });
    store.saveSession('2026-08-22', { ...topic, title: 'B' });
    store.saveSession('2026-08-23', { ...topic, title: 'C' });
    expect(store.recentTitles(10)).toEqual(['C', 'B', 'A']);
  });

  it('find pending recap only before the given date and when unanswered', () => {
    store.saveSession('2026-08-22', { ...topic, title: 'Yesterday' });
    store.saveSession('2026-08-23', { ...topic, title: 'Today' });
    const pending = store.pendingRecap('2026-08-24');
    expect(pending?.title).toBe('Today');

    // After answering today's, only yesterday is still owed.
    store.markRecapAnswered('2026-08-23', 'yes');
    const stillOwed = store.pendingRecap('2026-08-24');
    expect(stillOwed?.title).toBe('Yesterday');
  });

  it('pendingRecap excludes a session on the given date itself', () => {
    store.saveSession('2026-08-23', topic);
    // With "today" = 2026-08-23, the same-day session is NOT owed yet.
    expect(store.pendingRecap('2026-08-23')).toBeUndefined();
    // The next day it becomes owed.
    expect(store.pendingRecap('2026-08-24')?.date).toBe('2026-08-23');
  });

  it('marks recap answered and graded', () => {
    store.saveSession('2026-08-23', topic);
    expect(store.markRecapAnswered('2026-08-23', 'I learned RAFT')).toBe(true);
    store.markRecapGraded('2026-08-23', true, 'solid!');
    const row = store.getSession('2026-08-23')!;
    expect(row.recap_answer).toBe('I learned RAFT');
    expect(row.recap_understood).toBe(1);
    expect(row.recap_feedback).toBe('solid!');
  });

  it('markRecapAnswered returns false for a missing session', () => {
    expect(store.markRecapAnswered('2026-08-21', 'x')).toBe(false);
  });

  it('gets the session strictly before a given date', () => {
    store.saveSession('2026-08-23', topic);
    expect(store.getSessionBefore('2026-08-24')?.date).toBe('2026-08-23');
    expect(store.getSessionBefore('2026-08-23')).toBeUndefined();
  });

  it('lists recent sessions newest-first for --list', () => {
    store.saveSession('2026-08-21', { ...topic, title: 'A' });
    store.saveSession('2026-08-22', { ...topic, title: 'B' });
    store.saveSession('2026-08-23', { ...topic, title: 'C' });
    const rows = store.recentSessions(10);
    expect(rows.map((r) => r.title)).toEqual(['C', 'B', 'A']);
    expect(rows[0].date).toBe('2026-08-23');
  });

  it('formats local dates in the configured timezone', () => {
    const berlin = new Date('2026-08-23T22:30:00Z');
    expect(toLocalDate(berlin, 'UTC')).toBe('2026-08-23');
    // Berlin is UTC+2 in August, so 22:30 UTC is already the 24th there.
    expect(toLocalDate(berlin, 'Europe/Berlin')).toBe('2026-08-24');
  });
});