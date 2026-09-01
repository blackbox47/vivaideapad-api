import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/**
 * Wire representation of a notification — matches the columns the SPA
 * consumes. Kept narrow on purpose so the client-side mappers in the
 * notification RTK Query services can stay declarative.
 */
export interface WireNotification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  linked_record_type: string | null;
  linked_record_id: string | null;
  read_state: 'unread' | 'read';
  read_at: string | null;
  created_at: string;
}

/**
 * SSE envelope. `notification` carries the full row for `created`/`updated`,
 * and just the id for `deleted` (the client already has the rest cached).
 */
export type StreamEnvelope =
  | { type: 'created'; notification: WireNotification }
  | { type: 'updated'; notification: WireNotification }
  | { type: 'deleted'; notification: { id: string } };

/**
 * In-process pub/sub for notification SSE streams.
 *
 * Subscribers are keyed by userId and kept in a per-user Set so the same
 * user can open multiple tabs and each tab gets its own events.
 *
 * Designed for single-instance deployments. When this API is horizontally
 * scaled, swap the body of `publishTo` for a Redis pub/sub fan-out — the
 * public surface stays the same.
 */
@Injectable()
export class NotificationsStreamService {
  private readonly subscribers = new Map<string, Set<Subject<MessageEvent>>>();

  /**
   * Subscribe to a user's notification stream. The returned Observable
   * removes its subscriber from the registry when the consumer
   * unsubscribes — NestJS's @Sse() adapter wires that teardown to
   * req.on('close'), so disconnected clients clean up automatically.
   */
  subscribe(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subject = new Subject<MessageEvent>();
      const set =
        this.subscribers.get(userId) ?? new Set<Subject<MessageEvent>>();
      set.add(subject);
      this.subscribers.set(userId, set);

      const inner = subject.subscribe(subscriber);

      return () => {
        inner.unsubscribe();
        subject.complete();
        const cur = this.subscribers.get(userId);
        if (!cur) return;
        cur.delete(subject);
        if (cur.size === 0) {
          this.subscribers.delete(userId);
        }
      };
    });
  }

  /** Push an envelope to every active stream for `userId`. No-op if none. */
  publishTo(userId: string, envelope: StreamEnvelope): void {
    const set = this.subscribers.get(userId);
    if (!set || set.size === 0) return;
    const message = toMessageEvent(envelope);
    for (const subject of set) {
      subject.next(message);
    }
  }

  /** Convenience for broadcasts — one envelope, many recipients. */
  publishToMany(userIds: string[], envelope: StreamEnvelope): void {
    if (userIds.length === 0) return;
    const message = toMessageEvent(envelope);
    for (const userId of userIds) {
      const set = this.subscribers.get(userId);
      if (!set || set.size === 0) continue;
      for (const subject of set) {
        subject.next(message);
      }
    }
  }

  /** Test/diagnostic helper. */
  subscriberCount(userId: string): number {
    return this.subscribers.get(userId)?.size ?? 0;
  }

  /** Test helper. */
  hasSubscribers(userId: string): boolean {
    return this.subscriberCount(userId) > 0;
  }
}

function toMessageEvent(envelope: StreamEnvelope): MessageEvent {
  const message: MessageEvent = {
    type: envelope.type,
    data: JSON.stringify(envelope),
  };
  if ('notification' in envelope && envelope.notification) {
    const candidate = envelope.notification as { id?: unknown };
    if (typeof candidate.id === 'string') {
      message.id = candidate.id;
    }
  }
  return message;
}
