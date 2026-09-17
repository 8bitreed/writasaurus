import { createEventBus } from "../../../framework/events/event-bus.ts";

export interface EditorEvents {
  command: {
    command: string;
    target: string;
    value?: string;
  };
  focusChapterTitle: undefined;
  toggleSidebar: undefined;
}

export const editorEvents = createEventBus<EditorEvents>();

export const TOGGLE_WRITING_ASSISTANCE_EVENT = "writasaurus:toggle-writing-assistance";

export function toggleWritingAssistancePanel(): void {
  globalThis.dispatchEvent(new Event(TOGGLE_WRITING_ASSISTANCE_EVENT));
}
