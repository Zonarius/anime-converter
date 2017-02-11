declare module 'inotify' {
  type EventType = number;
  type WatchDescriptor = number;

  interface WatchConfig {
    path: string;
    watch_for: EventType;
    callback: (event: Event) => void;
  }

  interface Event {
    watch: WatchDescriptor;
    mask: EventType,
    cookie: number,
    name?: string;
  }

  export class Inotify {
    constructor(persistentMode?: boolean);

    addWatch(config: WatchConfig): WatchDescriptor;
    removeWatch(descriptor: WatchDescriptor): boolean;
    close(): boolean;

    static IN_ACCESS: EventType;
    static IN_ATTRIB: EventType;
    static IN_CLOSE_WRITE: EventType;
    static IN_CLOSE_NOWRITE: EventType;
    static IN_CREATE: EventType;
    static IN_DELETE: EventType;
    static IN_DELETE_SELF: EventType;
    static IN_MODIFY: EventType;
    static IN_MOVE_SELF: EventType;
    static IN_MOVED_FROM: EventType;
    static IN_MOVED_TO: EventType;
    static IN_OPEN: EventType;
    static IN_ALL_EVENTS: EventType;
    static IN_CLOSE: EventType;
    static IN_MOVE: EventType;
    static IN_ONLYDIR: EventType;
    static IN_DONT_FOLLOW: EventType;
    static IN_ONESHOT: EventType;
    static IN_MASK_ADD: EventType;
    static IN_IGNORED: EventType;
    static IN_ISDIR: EventType;
    static IN_Q_OVERFLOW: EventType;
    static IN_UNMOUNT: EventType;
  }

}