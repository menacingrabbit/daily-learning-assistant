import type { AppConfig } from '../config.js';
import type { SessionRow } from '../db/schema.js';
import type { Llm } from './llm.js';
import type { GenerateTopicContext } from './prompts.js';
import type { RecapResult, TopicResult } from './tools.js';

/**
 * Offline topic source used when OPENROUTER_API_KEY is absent — lets the whole
 * loop run end-to-end (tests, dry-run) without any credential or HTTP call.
 * Topics are generic study prompts (the seed list can't know the configured
 * subject), oriented toward reading/understanding rather than hands-on work.
 */

const FALLBACK_SEED: Array<Omit<TopicResult, 'estimatedMinutes'>> = [
  {
    title: 'Read one good explainer end to end',
    summary:
      'Find a solid article, chapter or talk on a topic in the subject and read it in one ' +
      'sitting. Note the two ideas that were new to you.',
    resources: ['https://en.wikipedia.org/wiki/Main_Page'],
  },
  {
    title: 'Understand the core idea behind one named concept',
    summary:
      'Pick a term or concept in the subject you’ve heard but could not explain. Work out what ' +
      'problem it solves and why it exists.',
    resources: [],
  },
  {
    title: 'Compare two competing approaches',
    summary:
      'Read up on two different ways the subject solves the same problem, then note their ' +
      'trade-offs and when each one wins.',
    resources: [],
  },
  {
    title: 'Trace one concept through a real system',
    summary:
      'Pick a real-world system, product or codebase that uses the subject, and follow one ' +
      'concept from documentation to how it actually shows up.',
    resources: ['https://github.com/search?q=stars%3A%3E1000&type=repositories'],
  },
  {
    title: 'Write down what you now understand',
    summary:
      'Maintain a “today I dug into” log: what surprised you, what you now understand, and the ' +
      'one thing you’d read about next. Write this session’s entry.',
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