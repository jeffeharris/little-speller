import { initSpeech, speak, speakLetter, speakWord, stopSpeech } from '$lib/utils/speech.js';
import {
  resumeAudio,
  stopNarration as stopNarrationAudio,
  playPop,
  playThud,
  playCelebration,
  playLetterSound,
  playLetterSoundImmediate,
  playIsSpelled,
  playGreeting,
  playEncouragement
} from '$lib/utils/sounds.js';

const DEFAULT_MIN_DURATIONS = {
  letter: 350,
  word: 500,
  phrase: 900,
  greeting: 2200,
  encouragement: 1400
};

const DEFAULT_BUFFERS = {
  letterAfter: 220,
  phraseAfter: 250,
  greetingAfter: 350,
  encouragementAfter: 250
};

export function createAudioService({ minDurations = {}, buffers = {} } = {}) {
  // Defaults are conservative minimums so narration feels paced even when
  // metadata is missing or TTS is used. Recorded clip metadata (when available)
  // overrides the minimums, and caller-supplied minDurations/buffers override
  // these defaults.
  const timing = { ...DEFAULT_MIN_DURATIONS, ...minDurations };
  const timingBuffers = { ...DEFAULT_BUFFERS, ...buffers };

  function ensureSpeechReady() {
    initSpeech();
  }

  function unlockAudio() {
    ensureSpeechReady();
    resumeAudio();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(unlock);
    }
  }

  function stopNarration() {
    stopSpeech();
    stopNarrationAudio();
  }

  function playSfx(type) {
    if (type === 'pop') playPop();
    if (type === 'thud') playThud();
    if (type === 'celebration') playCelebration();
  }

  async function playLetter(letter, { immediate = false, startAtMs } = {}) {
    if (!letter) {
      return { durationMs: 0, bufferMs: timingBuffers.letterAfter };
    }
    const duration = immediate
      ? playLetterSoundImmediate(letter, { startAtMs })
      : playLetterSound(letter, { startAtMs });
    if (duration) {
      return { durationMs: duration, bufferMs: timingBuffers.letterAfter };
    }

    ensureSpeechReady();
    void speakLetter(letter);
    return { durationMs: timing.letter, bufferMs: timingBuffers.letterAfter };
  }

  async function playWord(word, { rate = 0.75, text } = {}) {
    if (!word) {
      return { durationMs: 0, bufferMs: 0 };
    }

    ensureSpeechReady();
    const spokenText = text ?? word;
    if (text || rate !== 0.75) {
      void speak(spokenText, rate);
    } else {
      void speakWord(spokenText);
    }

    return { durationMs: timing.word, bufferMs: 0 };
  }

  async function playPhrase(key, { startAtMs } = {}) {
    if (!key) {
      return { durationMs: 0, bufferMs: 0 };
    }

    if (key === 'greeting') {
      const duration = await playGreeting({ startAtMs });
      if (duration) {
        return { durationMs: duration, bufferMs: timingBuffers.greetingAfter };
      }

      ensureSpeechReady();
      void speak('Hello, little speller!', 0.82);
      return { durationMs: timing.greeting, bufferMs: timingBuffers.greetingAfter };
    }

    if (key === 'isSpelled') {
      const duration = playIsSpelled({ startAtMs });
      if (duration) {
        return { durationMs: duration, bufferMs: timingBuffers.phraseAfter };
      }
      return { durationMs: timing.phrase, bufferMs: timingBuffers.phraseAfter };
    }

    if (key === 'encouragement') {
      const duration = playEncouragement({ startAtMs });
      if (duration) {
        return { durationMs: duration, bufferMs: timingBuffers.encouragementAfter };
      }
      return { durationMs: 0, bufferMs: 0 };
    }

    return { durationMs: 0, bufferMs: 0 };
  }

  return {
    unlockAudio,
    stopNarration,
    playSfx,
    playLetter,
    playWord,
    playPhrase
  };
}

export const audioService = createAudioService();
