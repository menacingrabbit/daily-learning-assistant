import { describe, it, expect } from 'vitest';
import { systemPrompt, topicPrompt } from '../src/agent/prompts.js';
import type { AppConfig } from '../src/config.js';

const base: AppConfig = {
  subject: 'getting into AI software engineering',
  sessionLengthMinutes: 15,
  difficulty: 'intermediate',
  checkinStyle: 'recap_question',
  reminderTime: '08:00',
  timezone: 'Europe/Berlin',
};

const ctx = {
  subject: base.subject,
  difficulty: base.difficulty,
  sessionLengthMinutes: base.sessionLengthMinutes,
  recentTitles: [],
};

describe('prompts', () => {
  it('includes the stack preference when configured', () => {
    expect(systemPrompt({ ...base, stack: 'TypeScript/Node' })).toContain('TypeScript/Node');
    expect(topicPrompt({ ...ctx, stack: 'TypeScript/Node' })).toContain('TypeScript/Node');
  });

  it('leaves the prompt clean when no stack is configured', () => {
    // The app is subject-agnostic, so an unset stack must not leak a language
    // hint (or a stray blank line) into the prompt.
    const sys = systemPrompt(base);
    expect(sys).not.toMatch(/TypeScript|Python|tools\/language/i);
    expect(sys).not.toMatch(/\n\n/);
    expect(topicPrompt(ctx)).not.toMatch(/tools\/language/i);
    expect(topicPrompt(ctx)).not.toMatch(/\n\n/);
  });

  it('sizes the topic from the session length, not a fixed count', () => {
    const prompt = topicPrompt(ctx);
    expect(prompt).toContain('15 minutes');
    expect(prompt).toContain('Never state a line count');
  });

  it('orients topics toward understanding, not exercises', () => {
    const sys = systemPrompt(base);
    const topic = topicPrompt(ctx);
    expect(sys).toContain('prefer explanatory topics');
    expect(sys).not.toMatch(/practicing\/explaining|must be actionable/i);
    expect(topic).toContain('LEARN ABOUT');
    expect(topic).not.toMatch(/any exercise/i);
  });

  it('lists recent titles for repeat-avoidance', () => {
    const prompt = topicPrompt({ ...ctx, recentTitles: ['A topic', 'Another topic'] });
    expect(prompt).toContain('- A topic');
    expect(prompt).toContain('- Another topic');
  });

  it('says none yet when there is no history', () => {
    expect(topicPrompt(ctx)).toContain('(none yet)');
  });
});