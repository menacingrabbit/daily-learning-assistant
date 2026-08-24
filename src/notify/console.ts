import { createInterface } from 'node:readline';
import type { InboundMessage, Notifier, OutboundMessage, ReplyHandler } from './notifier.js';

/**
 * Dry-run Notifier: prints outbound messages to the console and reads user
 * replies from stdin. Used when no Telegram token is configured, so the whole
 * loop is exercisable locally before any real credential exists. Chat id is
 * fake but stable so reply attribution code paths are unchanged.
 */
export class ConsoleNotifier implements Notifier {
  readonly name = 'console';

  private rl?: ReturnType<typeof createInterface>;

  constructor(private readonly chatId = 'local-user') {}

  async send(message: OutboundMessage): Promise<void> {
    console.log(`\n--- [console out] ---`);
    console.log(message.text);
    console.log(`--- [console end] ---\n`);
  }

  async startListening(handler: ReplyHandler): Promise<void> {
    if (this.rl) return;
    this.rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('Dry-run mode: type a reply and press Enter to answer the recap (Ctrl+C to quit).');
    this.rl.on('line', (line) => {
      const text = line.trim();
      if (text.length === 0) return;
      const inbound: InboundMessage = { chatId: this.chatId, text };
      void handler(inbound);
    });
  }

  async stop(): Promise<void> {
    this.rl?.close();
    this.rl = undefined;
  }
}