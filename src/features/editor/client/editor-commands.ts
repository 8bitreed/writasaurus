interface LegacyEditorDocument {
  execCommand(commandId: string, showUI?: boolean, value?: string): boolean;
}

/**
 * Compatibility boundary for contenteditable commands. There is no equivalent
 * interoperable replacement for selection-aware formatting commands yet.
 */
export function executeEditorCommand(command: string, value?: string): boolean {
  return (document as unknown as LegacyEditorDocument).execCommand(command, false, value);
}
