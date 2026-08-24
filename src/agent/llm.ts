import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, isStepCount } from 'ai';
import type { AppConfig } from '../config.js';
import type { SessionRow } from '../db/schema.js';
import { recapCheckPrompt, systemPrompt, topicPrompt, type GenerateTopicContext } from './prompts.js';
import { buildTools, checkRecapTool, generateTopicTool } from './tools.js';
import type { RecapResult, TopicResult } from './tools.js';

/**
 * The model-facing surface the agent loop depends on. Two implementations:
 * `OpenRouterLlm` (real calls) and `FallbackLlm` (offline, no credentials).
 */
export interface Llm {
  readonly name: string;
  /** Propose today's topic scoped by config + recent history. */
  generateTopic(ctx: GenerateTopicContext, config: AppConfig): Promise<TopicResult>;
  /**
   * Grade the user recap of a previous session (recap_question style).
   * Returns null when grading isn't applicable (confirm_only style, fallback).
   */
  checkRecap(session: SessionRow, config: AppConfig): Promise<RecapResult | null>;
}

/** Real implementation: AI SDK tool-calling against OpenRouter. */
export class OpenRouterLlm implements Llm {
  readonly name = 'openrouter';

  constructor(private readonly apiKey: string, private readonly modelId: string) {}

  private get model() {
    return createOpenRouter({ apiKey: this.apiKey })(this.modelId);
  }

  async generateTopic(ctx: GenerateTopicContext, config: AppConfig): Promise<TopicResult> {
    const result = await generateText({
      model: this.model,
      system: systemPrompt(config),
      prompt: topicPrompt(ctx),
      tools: { generateTopic: generateTopicTool() },
      toolChoice: { type: 'tool', toolName: 'generateTopic' },
      stopWhen: isStepCount(3),
    });
    const call = result.steps.flatMap((s) => s.toolCalls).find((tc) => tc.toolName === 'generateTopic');
    if (!call?.input) throw new Error('Model did not produce a topic');
    return call.input as TopicResult;
  }

  async checkRecap(session: SessionRow, config: AppConfig): Promise<RecapResult | null> {
    if (config.checkinStyle !== 'recap_question') return null;
    const result = await generateText({
      model: this.model,
      system: systemPrompt(config),
      prompt: recapCheckPrompt(session, config.subject),
      tools: { checkRecap: checkRecapTool() },
      toolChoice: { type: 'tool', toolName: 'checkRecap' },
      stopWhen: isStepCount(3),
    });
    const tool = result.steps.flatMap((s) => s.toolCalls).find((tc) => tc.toolName === 'checkRecap');
    if (!tool?.input) throw new Error('Model did not produce a recap grade');
    return tool.input as RecapResult;
  }
}

// Keep `buildTools` referenced so the schema stays the single source of truth
// if callers want the full tool set (e.g. future multi-part prompts).
export { buildTools };