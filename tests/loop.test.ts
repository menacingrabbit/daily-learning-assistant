import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/db/store.js';
import { runDaily, type LoopDeps } from '../src/agent/loop.js';
import type { Llm } from '../src/agent/llm.js';
import type { Notifier, OutboundMessage } from '../src/notify/notifier.js';
import type { AppConfig } from '../src/config.js';
import type { RecapResult, TopicResult } from '../src/agent/tools.js';

const CONFIG: AppConfig = {
  subject: 'software architecture & engineering',
  sessionLengthMinutes: 30,
  difficulty: 'intermediate',
  checkinStyle: 'recap_question',
  reminderTime: '08:00',
  timezone: 'Europe/Berlin',
};

class FakeNotifier implements Notifier {
  readonly name = 'fake';
  sent: OutboundMessage[] = [];

  async send(msg: OutboundMessage) {
    this.sent.push(msg);
  }
  async startListening(_handler: unknown) {}
  async stop() {}
}

class FakeLlm implements Llm {
  readonly name = 'fake';
  sent: string[] = [];
  constructor(
    private readonly topic: TopicResult,
    private readonly grade: RecapResult | null = null,
  ) {}

  async generateTopic(_ctx: unknown, _config: AppConfig): Promise<TopicResult> {
    this.sent.push('generateTopic');
    return this.topic;
  }
  async checkRecap(_session: unknown, _config: AppConfig): Promise<RecapResult | null> {
    this.sent.push('checkRecap');
    return this.grade;
  }
}

const DEFAULT_TOPIC: TopicResult = {
  title: 'Recursion as a first-class tool',
  summary: 'Learn to spot and write recursive solutions.',
  resources: [],
  estimatedMinutes: 30,
};

function makeDeps(
  now: Date,
  overrides: Partial<LoopDeps> = {},
  topic: TopicResult = DEFAULT_TOPIC,
  grade: RecapResult | null = null,
): LoopDeps {
  return {
    store: Store.inMemory(),
    notifier: new FakeNotifier(),
    llm: new FakeLlm(topic, grade),
    config: CONFIG,
    now: () => now,
    ...overrides,
  } as LoopDeps;
}

const NOW = new Date('2026-08-24T16:30:00Z');

describe('runDaily', () => {
  it('re-sends the pending recap instead of generating a new topic', async () => {
    const deps = makeDeps(NOW);
    deps.store.saveSession('2026-08-23', {
      title: 'Yesterday',
      summary: 'x',
      resources: [],
      estimatedMinutes: 30,
    });
    const notifier = deps.notifier as FakeNotifier;
    const llm = deps.llm as FakeLlm;

    const outcome = await runDaily(deps);
    expect(outcome.kind).toBe('recap_reminder');
    expect(notifier.sent[0]?.text).toContain('Yesterday');
    expect(llm.sent).toEqual([]);
    expect(deps.store.allSessions()).toHaveLength(1);
  });

  it('generates and persists a topic when no recap is owed', async () => {
    const deps = makeDeps(NOW);
    const notifier = deps.notifier as FakeNotifier;

    const outcome = await runDaily(deps);
    expect(outcome.kind).toBe('topic_sent');
    expect(deps.store.getSession('2026-08-24')?.title).toBe('Recursion as a first-class tool');
    expect(notifier.sent[0]?.text).toContain('Recursion as a first-class tool');
  });

  it('grades an unanswered recap before generating the topic (recap_question)', async () => {
    const deps = makeDeps(
      NOW,
      {},
      DEFAULT_TOPIC,
      { understood: true, feedback: 'Looks good.' },
    );
    deps.store.saveSession('2026-08-23', {
      title: 'Caches',
      summary: 'x',
      resources: [],
      estimatedMinutes: 30,
    });
    deps.store.markRecapAnswered('2026-08-23', 'LRU and friends');
    const llm = deps.llm as FakeLlm;

    const outcome = await runDaily(deps);
    expect(llm.sent).toContain('checkRecap');
    expect(llm.sent).toContain('generateTopic');
    expect(outcome.kind).toBe('topic_sent');
    const graded = deps.store.getSession('2026-08-23')!;
    expect(graded.recap_understood).toBe(1);
    expect(graded.recap_feedback).toBe('Looks good.');
  });

  it('does NOT grade in confirm_only style', async () => {
    const deps = makeDeps(NOW, {
      config: { ...CONFIG, checkinStyle: 'confirm_only' },
    });
    deps.store.saveSession('2026-08-23', {
      title: 'Caches',
      summary: 'x',
      resources: [],
      estimatedMinutes: 30,
    });
    deps.store.markRecapAnswered('2026-08-23', 'done!');
    const llm = deps.llm as FakeLlm;

    await runDaily(deps);
    expect(llm.sent).not.toContain('checkRecap');
    expect(llm.sent).toContain('generateTopic');
  });
});