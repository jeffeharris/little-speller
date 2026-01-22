// Sound effects handled via HTMLAudioElement for best iOS compatibility

const SOUND_PATHS = {
  pop: '/audio/placed_1.mp3',
  thud: '/audio/rejected.mp3',
  celebration: '/audio/success.mp3'
};

const LETTER_AUDIO_BASE = '/audio/letters';
const LETTER_FILE_MAP = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((char, index) => {
  const trackNumber = String(index + 5).padStart(2, '0');
  LETTER_FILE_MAP[char] = `${LETTER_AUDIO_BASE}/${trackNumber}-letter-${char}.ogg`;
});

const PHRASE_AUDIO_PATHS = {
  isSpelled: '/audio/phrases/04-is-spelled.ogg',
  greeting: '/audio/phrases/01-hello-little-speller.ogg',
  youDidGreat: '/audio/phrases/31-you-did-great.ogg',
  youCanSpell: '/audio/phrases/32-you-can-spell.ogg',
  youDidIt: '/audio/phrases/34-you-did-it.ogg',
  workingHard: '/audio/phrases/35-working-hard-at-this.ogg'
};

const sounds = {
  pop: null,
  thud: null,
  celebration: null
};

const letterAudios = {};
const phraseAudios = {};
let lastEncouragementKey = '';
let activeNarrationAudio = null;

let oggSupportCache;
function supportsOggPlayback() {
  if (oggSupportCache !== undefined) return oggSupportCache;
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
    oggSupportCache = true;
    return oggSupportCache;
  }
  try {
    const test = new window.Audio();
    oggSupportCache = typeof test.canPlayType === 'function'
      ? test.canPlayType('audio/ogg; codecs="vorbis"') !== ''
      : false;
  } catch {
    oggSupportCache = false;
  }
  return oggSupportCache;
}

let initialized = false;

function createAudio(path, volume = 1) {
  const audio = new Audio(path);
  audio.preload = 'auto';
  audio.volume = volume;
  return audio;
}

// Initialize all sound assets the first time we need them
function initSounds() {
  if (typeof window === 'undefined' || initialized) return;

  sounds.pop = createAudio(SOUND_PATHS.pop, 0.95);
  sounds.thud = createAudio(SOUND_PATHS.thud, 0.8);
  sounds.celebration = createAudio(SOUND_PATHS.celebration, 0.85);

  initialized = true;
}

function unlockSound(audio) {
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  }
}

async function playAudioDirect(audio) {
  if (!audio) return false;
  try {
    audio.pause();
    audio.currentTime = 0;
    const result = audio.play();
    if (result && typeof result.then === 'function') {
      try {
        await result;
      } catch (error) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

function playSound(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore play failures (typically autoplay policies)
  }
}

function playAudioFromTemplate(audio) {
  if (!audio) return false;
  const now = Date.now();
  const lastPlayed = audio.__lastPlayedTime || 0;
  if (now - lastPlayed < 120) {
    return false;
  }
  try {
    const instance = audio.cloneNode(true);
    instance.currentTime = 0;
    instance.volume = audio.volume;
    const result = instance.play();
    audio.__lastPlayedTime = now;
    if (result && typeof result.then === 'function') {
      result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function stopNarrationAudio() {
  if (!activeNarrationAudio) return;
  try {
    activeNarrationAudio.pause();
    activeNarrationAudio.currentTime = 0;
  } catch {
    // Ignore stop failures
  }
  activeNarrationAudio = null;
}

function playNarrationAudio(audio) {
  if (!audio) return false;
  if (activeNarrationAudio && activeNarrationAudio !== audio) {
    stopNarrationAudio();
  }
  activeNarrationAudio = audio;
  audio.onended = () => {
    if (activeNarrationAudio === audio) {
      activeNarrationAudio = null;
    }
  };
  try {
    audio.pause();
    audio.currentTime = 0;
    const result = audio.play();
    if (result && typeof result.then === 'function') {
      result.catch(() => {
        if (activeNarrationAudio === audio) {
          activeNarrationAudio = null;
        }
      });
    }
    return true;
  } catch {
    if (activeNarrationAudio === audio) {
      activeNarrationAudio = null;
    }
    return false;
  }
}

function cacheDurationOnLoad(audio, fallback) {
  if (!audio || audio.__durationListenerAttached) return fallback;
  audio.__durationListenerAttached = true;
  audio.addEventListener(
    'loadedmetadata',
    () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.__cachedDurationMs = audio.duration * 1000;
      }
    },
    { once: true }
  );
  return fallback;
}

function getAudioDurationMs(audio, fallback = 500) {
  if (!audio) return fallback;
  const cached = audio.__cachedDurationMs;
  if (typeof cached === 'number' && cached > 0) {
    return cached;
  }
  const duration = audio.duration;
  if (Number.isFinite(duration) && duration > 0) {
    const ms = duration * 1000;
    audio.__cachedDurationMs = ms;
    return ms;
  }
  return cacheDurationOnLoad(audio, fallback);
}

function getLetterAudio(letter) {
  if (!letter || !supportsOggPlayback()) return null;
  const upper = letter.toUpperCase();
  const path = LETTER_FILE_MAP[upper];
  if (!path) return null;
  if (!letterAudios[upper]) {
    letterAudios[upper] = createAudio(path, 0.95);
  }
  return letterAudios[upper];
}

function getPhraseAudio(key) {
  if (!supportsOggPlayback()) return null;
  const path = PHRASE_AUDIO_PATHS[key];
  if (!path) return null;
  if (!phraseAudios[key]) {
    phraseAudios[key] = createAudio(path, 0.95);
  }
  return phraseAudios[key];
}

// Resume audio (needed after user interaction on mobile)
export function resumeAudio() {
  initSounds();
  Object.values(sounds).forEach(unlockSound);
  Object.values(letterAudios).forEach(unlockSound);
  Object.values(phraseAudios).forEach(unlockSound);
}

export function stopNarration() {
  stopNarrationAudio();
}

// Play a satisfying suck-pop sound when letter snaps into place
export function playPop() {
  initSounds();
  playSound(sounds.pop);
}

// Play a low soft thud for wrong placement
export function playThud() {
  initSounds();
  playSound(sounds.thud);
}

// Play a bright tri-tone chime when the word is complete
export function playCelebration() {
  initSounds();
  playSound(sounds.celebration);
}

// Play recorded narration for the letter tiles and return clip length (ms)
export function playLetterSound(letter) {
  const audio = getLetterAudio(letter);
  if (!audio) return 0;
  const played = playNarrationAudio(audio);
  if (!played) return 0;
  return getAudioDurationMs(audio, 600);
}

export function playLetterSoundImmediate(letter) {
  const audio = getLetterAudio(letter);
  if (!audio) return 0;
  const played = playAudioFromTemplate(audio);
  if (!played) return 0;
  return getAudioDurationMs(audio, 600);
}

export function playIsSpelled() {
  const audio = getPhraseAudio('isSpelled');
  if (!audio) return 0;
  const played = playNarrationAudio(audio);
  if (!played) return 0;
  return getAudioDurationMs(audio, 900);
}

export async function playGreeting() {
  const audio = getPhraseAudio('greeting');
  if (!audio) return 0;
  stopNarrationAudio();
  activeNarrationAudio = audio;
  audio.onended = () => {
    if (activeNarrationAudio === audio) {
      activeNarrationAudio = null;
    }
  };
  const played = await playAudioDirect(audio);
  if (!played) {
    if (activeNarrationAudio === audio) {
      activeNarrationAudio = null;
    }
    return 0;
  }
  return getAudioDurationMs(audio, 2200);
}

export function playEncouragement() {
  const keys = ['youDidGreat', 'youCanSpell', 'youDidIt', 'workingHard'];
  const available = keys.filter(key => key !== lastEncouragementKey);
  const pool = available.length ? available : keys;
  const key = pool[Math.floor(Math.random() * pool.length)];
  lastEncouragementKey = key;
  const audio = getPhraseAudio(key);
  if (!audio) return 0;
  const played = playNarrationAudio(audio);
  if (!played) return 0;
  return getAudioDurationMs(audio, 1400);
}
