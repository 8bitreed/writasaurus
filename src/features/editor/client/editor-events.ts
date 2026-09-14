import { createEventBus } from "../../../framework/events/event-bus.ts";

export interface EditorEvents {
  command: {
    command: string;
    target: string;
    value?: string;
  };
  toggleSidebar: undefined;
}

export const editorEvents = createEventBus<EditorEvents>();
