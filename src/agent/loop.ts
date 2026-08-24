import type { AppConfig } from '../config.js';
import { toLocalDate, type Store } from '../db/store.js';
import type { Notifier } from '../notify/notifier.js';
import { recapMessage } from './prompts.js';
import type { Llm } from './llm.js';
import type { RecapResult, TopicResult } from './tools.js';

/**
 * The daily run.
 *
 * Maps to PLAN.md's "Core Agent Loop":
 *   1. Load yesterday's session; if its recap is pending and unanswered,
 *      re-send the recap instead of moving on.
 *   2. Otherwise grade the recap (recap_question style), then generate today's
 *      topic scoped by config + recent history.
 *   3. Persist the new session row, then notify.
 */

export interface LoopDeps {
  store: Store;
  notifier: Notifier;
  llm: Llm;
  config: AppConfig;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Extra context appended to recap/topic messages (e.g. run source). */
  tag?: string;
}

export type LoopOutcome =
  | { kind: 'recap_reminder'; date: string; sessionTitle: string }
  | { kind: 'topic_sent'; date: string; topic: TopicResult };

export async function runDaily(deps: LoopDeps): Promise<LoopOutcome> {
  const { store, notifier, llm, config } = deps;
  const now = deps.now?.() ?? new Date();
  const today = toLocalDate(now, config.timezone);

  // 1. Recap pending from a previous day? Re-send it — do not advance.
  const pending = store.pendingRecap(today);
  if (pending) {
    await notifier.send({ text: recapMessage({ date: pending.date, title: pending.title }) });
    return { kind: 'recap_reminder', date: today, sessionTitle: pending.title };
  }

  // 2. Yesterday existed and is still ungraded (recap_question style) → grade it.
  const yesterday = store.getSessionBefore(today);
  if (
    yesterday &&
    config.checkinStyle === 'recap_question' &&
    yesterday.recap_answer !== null &&
    yesterday.recap_understood === null
  ) {
    const grade: RecapResult | null = await llm.checkRecap(yesterday, config);
    if (grade) {
      store.markRecapGraded(yesterday.date, grade.understood, grade.feedback);
      await notifier.send({ text: formatGradeMessage(grade, yesterday.title) });
    }
  }

  // 3. Generate + persist today's topic.
  const topic: TopicResult = await llm.generateTopic(
    {
      subject: config.subject,
      difficulty: config.difficulty,
      sessionLengthMinutes: config.sessionLengthMinutes,
      recentTitles: store.recentTitles(10),
    },
    config,
  );
  store.saveSession(today, {
    title: topic.title,
    summary: topic.summary,
    resources: topic.resources ?? [],
    estimatedMinutes: topic.estimatedMinutes,
  });
  await notifier.send({ text: formatTopicMessage(topic) });

  return { kind: 'topic_sent', date: today, topic };
}

function formatGradeMessage(grade: RecapResult, title: string): string {
  const head = grade.understood ? '💪 Nice work' : '👀 Let’s tighten that';
  return `${head} on **${title}**:\n${grade.feedback}`;
}

function formatTopicMessage(topic: TopicResult): string {
  if (topic.resources && topic.resources.length > 0) {
    const res = topic.resources.map((r) => `- ${r}`).join('\n');
    return `📚 Today's topic: **${topic.title}**\n\n${topic.summary}\n\n⏱ ~${topic.estimatedMinutes} min\n\nResources:\n${res}`;
  }
  return `📚 Today's topic: **${topic.title}**\n\n${topic.summary}\n\n⏱ ~${topic.estimatedMinutes} min`;
}