import type { InboundMessage, Notifier, OutboundMessage, ReplyHandler } from './notifier.js';

const API_BASE = 'https://api.telegram.org';
const POLL_TIMEOUT_S = 30;

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: { id?: number };
    text?: string;
  };
}

interface TelegramResponse<T> {
  ok: boolean;
  description?: string;
  result?: T;
}

/**
 * Reference Notifier implementation for Telegram. Driven by the plain Bot API
 * over fetch — `sendMessage` for output, `getUpdates` long-polling for input —
 * so there's no extra SDK dependency.
 */
export class TelegramNotifier implements Notifier {
  readonly name = 'telegram';

  private offset = 0;
  private stopped = false;

  constructor(
    private readonly token: string,
    private readonly allowedChatId: string,
  ) {}

  private get base(): string {
    return `${API_BASE}/bot${this.token}`;
  }

  private async call<T>(method: string, payload: unknown): Promise<TelegramResponse<T>> {
    const res = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Telegram ${method} failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as TelegramResponse<T>;
    if (!data.ok) {
      throw new Error(`Telegram ${method} error: ${data.description ?? 'unknown'}`);
    }
    return data;
  }

  async send(message: OutboundMessage): Promise<void> {
    await this.call('sendMessage', {
      chat_id: this.allowedChatId,
      text: message.text,
      disable_web_page_preview: false,
    });
  }

  async startListening(handler: ReplyHandler): Promise<void> {
    this.stopped = false;
    void this.pollLoop(handler);
  }

  private async pollLoop(handler: ReplyHandler): Promise<void> {
    while (!this.stopped) {
      try {
        const data = await this.call<TelegramUpdate[]>('getUpdates', {
          offset: this.offset,
          timeout: POLL_TIMEOUT_S,
        });
        for (const update of data.result ?? []) {
          this.offset = update.update_id + 1;
          const text = update.message?.text?.trim();
          const chatId = update.message?.chat?.id;
          if (text && chatId !== undefined && String(chatId) === this.allowedChatId) {
            const inbound: InboundMessage = { chatId: String(chatId), text };
            await handler(inbound);
          }
        }
      } catch {
        // Networking hiccup — retry the long poll after a short delay.
        if (this.stopped) break;
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }
}