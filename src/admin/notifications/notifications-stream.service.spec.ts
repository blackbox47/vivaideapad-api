import { MessageEvent } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import {
  NotificationsStreamService,
  WireNotification,
} from './notifications-stream.service';

function makeWire(overrides: Partial<WireNotification> = {}): WireNotification {
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    recipient_id: overrides.recipient_id ?? 'user-a',
    type: overrides.type ?? 'system',
    title: overrides.title ?? 'Test notification',
    body: overrides.body ?? null,
    payload: overrides.payload ?? null,
    linked_record_type: overrides.linked_record_type ?? null,
    linked_record_id: overrides.linked_record_id ?? null,
    read_state: overrides.read_state ?? 'unread',
    read_at: overrides.read_at ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

describe('NotificationsStreamService', () => {
  let service: NotificationsStreamService;

  beforeEach(() => {
    service = new NotificationsStreamService();
  });

  it('returns an Observable that yields published events', async () => {
    const stream = service.subscribe('user-a');
    const received: MessageEvent[] = [];
    const sub = stream.subscribe((event) => received.push(event));

    service.publishTo('user-a', {
      type: 'created',
      notification: makeWire({ id: 'n-1' }),
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('created');
    expect(received[0].id).toBe('n-1');
    sub.unsubscribe();
  });

  it('does not notify other users', async () => {
    const streamA = service.subscribe('user-a');
    const streamB = service.subscribe('user-b');
    const receivedA: MessageEvent[] = [];
    const receivedB: MessageEvent[] = [];
    const subA = streamA.subscribe((e) => receivedA.push(e));
    const subB = streamB.subscribe((e) => receivedB.push(e));

    service.publishTo('user-a', {
      type: 'created',
      notification: makeWire({ id: 'n-1' }),
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('removes subscribers from the Map on teardown', async () => {
    const stream = service.subscribe('user-a');
    const sub = stream.subscribe(() => {
      /* no-op */
    });
    expect(service.subscriberCount('user-a')).toBe(1);

    sub.unsubscribe();

    expect(service.subscriberCount('user-a')).toBe(0);
    expect(service.hasSubscribers('user-a')).toBe(false);
  });

  it('removes the user entry from the Map when the last subscriber unsubscribes', async () => {
    const stream1 = service.subscribe('user-a');
    const stream2 = service.subscribe('user-a');
    const sub1 = stream1.subscribe(() => {});
    const sub2 = stream2.subscribe(() => {});

    expect(service.subscriberCount('user-a')).toBe(2);

    sub1.unsubscribe();
    expect(service.subscriberCount('user-a')).toBe(1);
    expect(service.hasSubscribers('user-a')).toBe(true);

    sub2.unsubscribe();
    expect(service.hasSubscribers('user-a')).toBe(false);
  });

  it('fans out to every subscriber for the same user', async () => {
    const tab1 = service.subscribe('user-a');
    const tab2 = service.subscribe('user-a');
    const received1: MessageEvent[] = [];
    const received2: MessageEvent[] = [];
    const sub1 = tab1.subscribe((e) => received1.push(e));
    const sub2 = tab2.subscribe((e) => received2.push(e));

    service.publishTo('user-a', {
      type: 'updated',
      notification: makeWire({ id: 'n-2', read_state: 'read' }),
    });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    expect(received1[0].type).toBe('updated');
    expect(received2[0].type).toBe('updated');
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('publishToMany reaches each recipient independently', async () => {
    const streamA = service.subscribe('user-a');
    const streamB = service.subscribe('user-b');
    const receivedA: MessageEvent[] = [];
    const receivedB: MessageEvent[] = [];
    const subA = streamA.subscribe((e) => receivedA.push(e));
    const subB = streamB.subscribe((e) => receivedB.push(e));

    service.publishToMany(['user-a', 'user-b'], {
      type: 'created',
      notification: makeWire({ id: 'n-3' }),
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('is a no-op when publishing to a user with no subscribers', () => {
    expect(() =>
      service.publishTo('ghost', {
        type: 'created',
        notification: makeWire(),
      }),
    ).not.toThrow();
  });

  it('encodes the envelope as JSON in data:', async () => {
    const stream = service.subscribe('user-a');
    const eventPromise = firstValueFrom(stream);
    service.publishTo('user-a', {
      type: 'created',
      notification: makeWire({ id: 'n-4', title: 'Hello' }),
    });

    const event = await eventPromise;
    expect(event).toBeDefined();
    const parsed = JSON.parse(String(event.data));
    expect(parsed.type).toBe('created');
    expect(parsed.notification.title).toBe('Hello');
  });

  it('sets the SSE id field for deleted events', async () => {
    const stream = service.subscribe('user-a');
    const eventPromise = firstValueFrom(stream);
    service.publishTo('user-a', {
      type: 'deleted',
      notification: { id: 'n-5' },
    });

    const event = await eventPromise;
    expect(event.id).toBe('n-5');
    expect(event.type).toBe('deleted');
  });
});
