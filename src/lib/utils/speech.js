// Web Speech API wrapper for text-to-speech

let synth = null;
let voice = null;

// Debug: track last speech attempt (visible in app)
export let lastSpeechDebug = { text: '', status: '', time: '' };

// Initialize speech synthesis
export function initSpeech() {
  if (typeof window === 'undefined') return;

  synth = window.speechSynthesis;

  // Try to get a good English voice
  const loadVoices = () => {
    const voices = synth.getVoices();
    // Prefer a female English voice (usually clearer for kids)
    voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female')) ||
            voices.find(v => v.lang.startsWith('en-US')) ||
            voices.find(v => v.lang.startsWith('en')) ||
            voices[0];
    lastSpeechDebug = {
      text: '',
      status: `init: ${voices.length} voices, using: ${voice?.name || 'none'}`,
      time: new Date().toLocaleTimeString()
    };
  };

  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
}

// Speak a word or letter
export function speak(text, rate = 0.8, { cancel = true } = {}) {
  if (!synth) return Promise.resolve();

  if (cancel) {
    synth.cancel();
  }

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = 1.1; // Slightly higher pitch for kid-friendliness
    utterance.volume = 1;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    synth.speak(utterance);
  });
}

// Speak a single letter
export function speakLetter(letter) {
  return speak(letter.toLowerCase(), 0.7);
}

// Speak the full word
export function speakWord(word) {
  return speak(word, 0.75);
}

export function stopSpeech() {
  if (!synth) return;
  synth.cancel();
}
