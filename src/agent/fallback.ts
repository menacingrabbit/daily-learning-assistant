import type { AppConfig } from '../config.js';
import type { SessionRow } from '../db/schema.js';
import type { Llm } from './llm.js';
import type { GenerateTopicContext } from './prompts.js';
import type { RecapResult, TopicResult } from './tools.js';

/**
 * Offline topic source used when OPENROUTER_API_KEY is absent — lets the whole
 * loop run end-to-end (tests, dry-run) without any credential or HTTP call.
 * Topics are generic study exercises (the seed list can't know the configured
 * subject), so output is explicitly labeled "offline mode".
 */

const FALLBACK_SEED: Array<Omit<TopicResult, 'estimatedMinutes'>> = [
  {
    title: 'Teach the current topic out loud',
    summary:
      'Explain yesterday’s / today’s material as if to a colleague. Use the Feynman technique: ' +
      'simplify, find gaps, fix them.',
    resources: [
      'https://en.wikipedia.org/wiki/Learning_by_teaching',
      'https://en.wikipedia.org/wiki/Feynman_technique',
    ],
  },
  {
    title: 'Worked example: build a tiny demo end-to-end',
    summary:
      'Pick one concrete idea from the subject and implement a minimal, runnable demo of it, ' +
      'wiring every layer yourself. Deploy it, then remove it.',
    resources: [],
  },
  {
    title: 'Compare two approaches on the same problem',
    summary:
      'Take a design/engineering question in the subject and work through two different ' +
      'approaches in writing: trade-offs, failure modes, when one wins.',
    resources: [],
  },
  {
    title: 'Map what you learned to a real codebase',
    summary:
      'Find an open-source codebase that exercises the subject, trace one feature end-to-end, ' +
      'and annotate how the area you learned shows up there.',
    resources: ['https://github.com/search?q=stars%3A%3E1000&type=repositories'],
  },
  {
    title: 'Write the next chapter of your deep-dive notes',
    summary:
      'Maintain a “today I dug into” log: what surprised you, what you now understand, and the ' +
      'one thing you’d study next. Write this session’s entry.',
    resources: [],
  },
];

export class FallbackLlm implements Llm {
  readonly name = 'fallback';

  async generateTopic(ctx: GenerateTopicContext, config: AppConfig): Promise<TopicResult> {
    // Deterministic rotation: skip titles already covered, else rotate by length.
    const unused = FALLBACK_SEED.filter((t) => !ctx.recentTitles.includes(t.title));
    const pool = unused.length ? unused : FALLBACK_SEED;
    const idx = (ctx.recentTitles.length + pool.length) % pool.length;
    const base = pool[idx]!;
    return {
      ...base,
      estimatedMinutes: config.sessionLengthMinutes,
    };
  }

  async checkRecap(_session: SessionRow, _config: AppConfig): Promise<RecapResult | null> {
    // Offline: acknowledge honestly without faking a grade.
    return null;
  }
}