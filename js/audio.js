// Audio (SPEC §9, decisions 0004 and 0010): the browser's speechSynthesis with a European
// Portuguese (pt-PT) voice, never pt-BR or a generic "pt" voice. With no pt-PT voice, audio
// is off: speak() does nothing and Play buttons are hidden (body.no-audio). Callers only use
// speak()/stop(), so pre-recorded files can replace this module later.
// choosePtPtVoice is pure and tested (test/audio.test.mjs); the rest needs a browser.

const VOICE_KEY = 'ancoras.voice';
const RATE = 0.9;

// "pt-PT", "pt_PT", "PT-pt" … are European Portuguese; "pt-BR" and bare "pt" are not.
export function isPtPt(lang) {
  return typeof lang === 'string' && lang.replace('_', '-').toLowerCase() === 'pt-pt';
}

// The voice to use: the preferred one (by name) if it is a pt-PT voice, else the first pt-PT
// voice; undefined when there is none.
export function choosePtPtVoice(voices, preferredName) {
  const pt = (Array.isArray(voices) ? voices : []).filter(v => isPtPt(v?.lang));
  return pt.find(v => v.name === preferredName) ?? pt[0];
}

// --- Browser part ---

const synth = () => globalThis.speechSynthesis ?? null;
let ptVoices = [];
let preferred = null; // set from the home screen; otherwise the remembered name is used
const listeners = [];

function storedName() {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

function refreshVoices() {
  const s = synth();
  ptVoices = s ? s.getVoices().filter(v => isPtPt(v.lang)) : [];
  globalThis.document?.body.classList.toggle('no-audio', ptVoices.length === 0);
  listeners.forEach(fn => fn());
}

// Call once at start-up. Voices often arrive later (Safari/iOS), so listen for changes too.
export function initAudio() {
  refreshVoices();
  synth()?.addEventListener?.('voiceschanged', refreshVoices);
}

// Re-run `fn` whenever the voice list changes (e.g. to redraw the home screen's Audio line).
export function onVoicesChanged(fn) {
  listeners.push(fn);
}

export const audioAvailable = () => ptVoices.length > 0;
export const voiceNames = () => ptVoices.map(v => v.name);
export const currentVoiceName = () => choosePtPtVoice(ptVoices, preferred ?? storedName())?.name;

export function setPreferredVoice(name) {
  try {
    localStorage.setItem(VOICE_KEY, name);
  } catch {
    // Not remembered; the choice still applies until the page is closed.
  }
  preferred = name;
}

export function stop() {
  synth()?.cancel();
}

// Speak `text` in pt-PT, cutting off anything already playing. No pt-PT voice: nothing.
export function speak(text) {
  const s = synth();
  const voice = choosePtPtVoice(ptVoices, preferred ?? storedName());
  if (!s || !voice || typeof text !== 'string' || !text.trim()) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = 'pt-PT';
  u.rate = RATE;
  s.speak(u);
}
