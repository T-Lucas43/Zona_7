import type { PlayerNotification } from "@/server/repositories/character-repository";

export const liveNotificationEvent = "z7:notification";

export function publishLiveNotification(notification: PlayerNotification) {
  window.dispatchEvent(new CustomEvent<PlayerNotification>(liveNotificationEvent, { detail: notification }));
}

export function mergeNotifications(
  incoming: PlayerNotification[],
  current: PlayerNotification[],
) {
  const items = new Map<string, PlayerNotification>();
  for (const item of [...incoming, ...current]) {
    if (!items.has(item.id)) items.set(item.id, item);
  }
  return [...items.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 50);
}
