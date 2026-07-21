/** Keyboard gestures that should promote an existing DOM selection to learning actions. */
export function shouldCaptureKeyboardSelection(key: string, shiftKey: boolean): boolean {
  return key === "Enter" || (shiftKey && key.startsWith("Arrow"));
}
