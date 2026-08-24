/**
 * Notification channel abstraction.
 *
 * The rest of the agent talks only to this interface, so a second channel
 * (Discord, Slack, email, …) can be added without touching core logic.
 */

export interface OutboundMessage {
  text: string;
  /** Optional inline reply buttons / menu. Telegram reference uses [] (none). */
  buttons?: Array<{ text: string; payload: string }>;
}

/** An inbound user reply in the channel. */
export interface InboundMessage {
  /** Channel-specific chat id to attribute the reply to. */
  chatId: string;
  text: string;
}

/** Lifecycle hook the app uses to process user replies. */
export type ReplyHandler = (message: InboundMessage) => void | Promise<void>;

export interface Notifier {
  /** Send a message on the channel. */
  send(message: OutboundMessage): Promise<void>;
  /**
   * Start listening for replies. Must be idempotent-safe to call once at boot;
   * the reference Telegram impl uses getUpdates long-polling.
   */
  startListening(handler: ReplyHandler): Promise<void>;
  /** Stop polling / release resources. */
  stop(): Promise<void>;
  /** Human-readable label for logs, e.g. "telegram" | "console". */
  readonly name: string;
}