# 0010. Audio behaviour

- **Date:** 2026-10-09
- **Status:** accepted (advisor's defaults for M5, #6; agreed by Jim)

## Context
SPEC §9 and decision 0004: browser `speechSynthesis` with a pt-PT voice, never pt-BR, silent
when there is none, all behind one small function so pre-generated files can replace it.
M5 has to settle how the voice is chosen, when audio plays, and what the learner sees.

## Decision
- **Voice choice is pure and tested** (`choosePtPtVoice` in js/audio.js): only voices whose
  `lang` is pt-PT (accepting `pt_PT` and case variants); the remembered preferred voice if
  present, else the first pt-PT voice; undefined when none. Never a pt-BR or generic "pt"
  voice.
- **Voices load late** on some browsers (Safari/iOS, and Chrome on this Mac: the first read
  saw only a partial list). The voice list is read at start-up and again on `voiceschanged`;
  `speak()` looks the voice up at call time.
- **speak(text)** cancels anything playing, then speaks with lang "pt-PT", the chosen voice,
  rate 0.9. With no pt-PT voice it does nothing.
- **When audio plays:** the Meet card plays its anchor when shown (both turns for an echo
  pair) and the Echo screen plays its question when shown; Play repeats. Browsers block
  speech before the first tap, and Start is that tap. After a graded Recall / Echo /
  Transfer answer, a "▶ Play" button is offered on the revealed phrase, with no auto-play.
  Speech stops when the screen changes or the session is left.
- **Home screen:** an Audio line in the "Progress and audio" box. With pt-PT voices, a
  dropdown of them (by name), remembered in localStorage ("ancoras.voice"); choosing one
  plays a short sample. With none, one notice ("No European Portuguese voice on this device,
  so audio is off. On a Mac or iPhone, add one under Accessibility › Spoken Content › System
  voice › Manage voices › Portuguese (Portugal). On Android: Settings › search for
  'Text-to-speech' › Speech Services by Google › settings › Install voice data › Portuguese
  (Portugal).") on the home screen only, and every Play
  button is hidden (`body.no-audio`).

## Consequences
Audio quality depends on the device's installed voices; the Enhanced pt-PT voices sound
noticeably better and can be picked in the dropdown. Replacing speech with recorded files
later only touches js/audio.js.
