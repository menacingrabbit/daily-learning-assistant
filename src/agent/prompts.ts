import type { AppConfig } from '../config.js';
import type { SessionRow } from '../db/schema.js';

/**
 * Prompt builders. Everything user-configurable (subject, difficulty, session
 * length, check-in style) is injected here rather than hardcoded.
 */

export function systemPrompt(config: AppConfig): string {
  return [
    `You are a daily learning coach. The learner studies "${config.subject}" at a ` +
      `${config.difficulty} level, in sessions of about ` +
      `${config.sessionLengthMinutes} minutes per day.`,
    'You have three jobs: (1) review the learner’s recap of the previous topic, ' +
      '(2) propose ONE concrete, self-contained topic sized to the session length, ' +
      '(3) stay topical and avoid repeating topics the learner already covered.',
    'Prefer concrete practicing/explaining tasks over passive reading. Topics must be actionable.',
  ].join('\n');
}

/** Prompt for the model when it should check a user recap. */
export function recapCheckPrompt(session: SessionRow, subject: string): string {
  return [
    `Yesterday's topic was: "${session.title}".`,
    session.summary ? `Summary: ${session.summary}` : '',
    `The learner's recap answer: "${session.recap_answer ?? ''}"`,
    ``,
    `Grade this recap honestly. Understood means they can explain the core idea; ` +
      `partially_understood means they touched it but misremember details; ` +
      `not_understood means the answers show little/no engagement.`,
    `Subject context: ${subject}`,
  ]
    .filter((l) => l.length > 0)
    .join('\n');
}

/** Raw inputs for generating a topic — filled by the agent loop. */
export interface GenerateTopicContext {
  subject: string;
  difficulty: string;
  sessionLengthMinutes: number;
  /** Previously covered titles, newest first, for repeat-avoidance. */
  recentTitles: string[];
}

/** Prompt asking the model to propose today's topic. */
export function topicPrompt(ctx: GenerateTopicContext): string {
  const recent = ctx.recentTitles.length
    ? ctx.recentTitles.map((t) => `- ${t}`).join('\n')
    : '(none yet)';
  return [
    `Generate today's learning topic. Requirements:`,
    `- Subject: ${ctx.subject}`,
    `- Depth: ${ctx.difficulty}`,
    `- Target session length: ~${ctx.sessionLengthMinutes} minutes. Over-long, vague, or theoretical topics are bad.`,
    `- MUST NOT repeat or heavily overlap the learner's existing topics:`,
    recent,
    `Return the topic, a 1-3 sentence summary, concrete resources/URLs to start with,`,
    `and your estimated minutes needed.`,
  ].join('\n');
}

/** Human-facing message formatting (kept here so DB/prompts don't leak markdown). */
export function formatTopicMessage(input: {
  title: string;
  summary: string;
  resources: string[];
  estimatedMinutes: number;
}): string {
  const lines = [
    `📚 Today's topic: **${input.title}**`,
    '',
    input.summary,
    '',
    `⏱ ~${input.estimatedMinutes} min`,
  ];
  if (input.resources?.length) {
    lines.push('', 'Resources:');
    for (const r of input.resources) lines.push(`- ${r}`);
  }
  return lines.filter((l) => l.length > 0).join('\n');
}

export function recapMessage(session: { date: string; title: string }): string {
  return `Did you engage with yesterday's topic **${session.title}** (${session.date})? ` +
    `Reply with a short recap.`;
}