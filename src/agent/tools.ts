import { tool } from 'ai';
import { z } from 'zod';

/**
 * AI SDK tool definitions (Vercel AI SDK v7).
 *
 * Both tools act as structured-output channels: `inputSchema` is the shape the
 * model is asked to produce, and `execute` passes the validated input through.
 * Persistence is done by the loop (plain function calls) per the PLAN.md note.
 */

export const topicResultSchema = z.object({
  title: z.string().min(2).describe('Short, concrete topic title'),
  summary: z.string().min(10).describe('1-3 sentence summary of what to do/learn'),
  resources: z
    .array(z.string().url())
    .max(5)
    .optional()
    .default([])
    .describe('Concrete URLs to start with'),
  estimatedMinutes: z
    .number()
    .int()
    .min(1)
    .max(480)
    .describe('Estimated minutes the learner needs'),
});
export type TopicResult = z.infer<typeof topicResultSchema>;

export const recapResultSchema = z.object({
  understood: z.boolean().describe('true if the user grasped the core idea'),
  feedback: z
    .string()
    .min(1)
    .describe('Short, motivating feedback for the user, 1-2 sentences'),
});
export type RecapResult = z.infer<typeof recapResultSchema>;

export function buildProposeTopicTool() {
  return tool({
    description:
      'Propose ONE concrete learning topic sized to the configured session length. ' +
      'The topic you output is what the learner will study today.',
    inputSchema: topicResultSchema,
    execute: async (input) => input,
  });
}

export function buildGradeRecapTool() {
  return tool({
    description:
      'Grade the learner’s recap of the previous topic and give short feedback. ' +
      'Must be called with understood=false when the recap is missing, empty, or sloppy.',
    inputSchema: recapResultSchema,
    execute: async (input) => input,
  });
}

/** The map of callable tools exposed to the model (keyed by the tool name). */
export function buildToolRegistry() {
  return {
    proposeTopic: buildProposeTopicTool(),
    gradeRecap: buildGradeRecapTool(),
  };
}