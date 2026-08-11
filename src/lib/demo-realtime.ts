export type DemoRealtimeEvent = {
  type: string;
  title: string;
  targetCharacterIds?: string[];
  createdAt: string;
};

const channelName = "zona7-demo-realtime";
const storageKey = "z7_demo_notifications";

export function publishDemoRealtime(event: Omit<DemoRealtimeEvent, "createdAt">) {
  const payload = { ...event, createdAt: new Date().toISOString() };
  localStorage.setItem(storageKey, JSON.stringify([payload, ...readDemoNotifications()].slice(0, 30)));
  const channel = new BroadcastChannel(channelName);
  channel.postMessage(payload);
  channel.close();
}

export function readDemoNotifications(): DemoRealtimeEvent[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as DemoRealtimeEvent[];
  } catch {
    return [];
  }
}

export const demoRealtimeChannel = channelName;
