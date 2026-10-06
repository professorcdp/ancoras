// Audio. Silent stub for now: M5 (#6) replaces the body with pt-PT speechSynthesis
// (never pt-BR; see decision 0004). Callers only ever use speak(), so the UI won't change.

export function speak(text) {
  void text;
}
