import { get, writable } from 'svelte/store';
import { createSequenceController, wait } from '$lib/utils/sequence.js';
import { audioService } from '$lib/services/audioService.js';

const ENCOURAGEMENT_EVERY = 3;

const FLOW_PHASES = {
  LOCKED: 'locked',
  GREETING: 'greeting',
  SHOWING: 'showing',
  INTRO: 'intro',
  PLAYING: 'playing',
  CELEBRATING: 'celebrating'
};

const FLOW_TRANSITIONS = {
  [FLOW_PHASES.LOCKED]: [FLOW_PHASES.GREETING],
  [FLOW_PHASES.GREETING]: [FLOW_PHASES.SHOWING, FLOW_PHASES.LOCKED],
  [FLOW_PHASES.SHOWING]: [FLOW_PHASES.INTRO, FLOW_PHASES.PLAYING],
  [FLOW_PHASES.INTRO]: [FLOW_PHASES.PLAYING, FLOW_PHASES.SHOWING],
  [FLOW_PHASES.PLAYING]: [FLOW_PHASES.CELEBRATING],
  [FLOW_PHASES.CELEBRATING]: [FLOW_PHASES.SHOWING]
};

export function createGameFlow({ game }) {
  const audio = audioService;
  const state = writable({
    flowPhase: FLOW_PHASES.LOCKED,
    celebrating: false,
    activeCelebrationSlot: -1,
    wordHighlightActive: false,
    lastCelebratedWord: '',
    introRunning: false,
    introCompletedWord: '',
    slotsReadyForWord: false,
    initialGreetingPlaying: false
  });

  let layout = { width: 0, height: 0, isLandscape: false };

  const narrationFlow = createSequenceController({
    onCancel: () => {
      audio.stopNarration();
      resetNarrationHighlights();
    }
  });

  function setState(patch) {
    state.update(current => ({
      ...current,
      ...patch
    }));
  }

  function transitionFlow(nextPhase) {
    const current = get(state);
    const allowed = FLOW_TRANSITIONS[current.flowPhase] || [];
    if (!allowed.includes(nextPhase)) return false;
    setState({ flowPhase: nextPhase });
    return true;
  }

  function resetNarrationHighlights() {
    setState({
      activeCelebrationSlot: -1,
      wordHighlightActive: false
    });
  }

  function isSequenceActive(sequence) {
    return !sequence || sequence.isCurrent();
  }

  async function sayWordWithPhrase(word, { highlight = false, sequence } = {}) {
    if (!word || !isSequenceActive(sequence)) return;

    if (highlight) {
      setState({ wordHighlightActive: true });
    }
    const { durationMs: wordDuration } = await audio.playWord(word, { rate: 0.75 });
    await wait(wordDuration, sequence?.signal);
    if (!isSequenceActive(sequence)) {
      if (highlight) {
        setState({ wordHighlightActive: false });
      }
      return;
    }
    if (highlight) {
      setState({ wordHighlightActive: false });
    }
    await wait(150, sequence?.signal);
    if (!isSequenceActive(sequence)) return;
    const { durationMs, bufferMs } = await audio.playPhrase('isSpelled');
    await wait(durationMs + bufferMs, sequence?.signal);
  }

  function setLayout(nextLayout) {
    layout = { ...layout, ...nextLayout };
  }

  function startNewWord(word) {
    setState({
      lastCelebratedWord: '',
      activeCelebrationSlot: -1,
      wordHighlightActive: false,
      introCompletedWord: '',
      slotsReadyForWord: false
    });
    transitionFlow(FLOW_PHASES.SHOWING);
    game.initWord(word, layout.width, layout.height, { isLandscape: layout.isLandscape });
  }

  async function handleTapToStart() {
    const current = get(state);
    if (current.flowPhase !== FLOW_PHASES.LOCKED) return;
    if (!transitionFlow(FLOW_PHASES.GREETING)) return;

    audio.unlockAudio();

    const sequence = narrationFlow.start('greeting');
    game.setPhase('showing');

    const word = game.getNextWord();
    const { durationMs, bufferMs } = await audio.playPhrase('greeting');
    if (!sequence.isCurrent()) return;

    setState({ initialGreetingPlaying: true });
    if (durationMs) {
      await wait(durationMs + bufferMs, sequence.signal);
    }
    if (!sequence.isCurrent()) {
      setState({ initialGreetingPlaying: false });
      return;
    }
    setState({ initialGreetingPlaying: false });
    startNewWord(word);
  }

  function handleSlotsReady(positions, updateWordCenter) {
    if (!positions || positions.length === 0) return;
    game.setSlotPositions(positions);
    setState({ slotsReadyForWord: true });
    updateWordCenter(positions);

    if (get(game).phase === 'showing' && get(state).flowPhase === FLOW_PHASES.SHOWING) {
      game.showWordInSlots();
      startIntroSequence(get(game).currentWord);
    }
  }

  async function startIntroSequence(word) {
    const {
      slotsReadyForWord,
      introRunning,
      introCompletedWord,
      initialGreetingPlaying,
      flowPhase
    } = get(state);
    if (
      !word ||
      !slotsReadyForWord ||
      introRunning ||
      introCompletedWord === word ||
      get(game).phase !== 'showing' ||
      initialGreetingPlaying ||
      flowPhase !== FLOW_PHASES.SHOWING
    ) return;

    if (!transitionFlow(FLOW_PHASES.INTRO)) return;
    setState({ introRunning: true });
    const sequence = narrationFlow.start('intro');
    resetNarrationHighlights();

    try {
      await runSpellingSequence(word, { includeInitialWord: true, sequence });
      if (!sequence.isCurrent()) return;
      setState({ introCompletedWord: word });
      await wait(200, sequence.signal);
      if (!sequence.isCurrent()) return;
      resetNarrationHighlights();
      game.scatterLetters();
      transitionFlow(FLOW_PHASES.PLAYING);
    } finally {
      setState({ introRunning: false });
    }
  }

  async function triggerCelebrationSequence(word) {
    const { celebrating, lastCelebratedWord, flowPhase } = get(state);
    if (!word || celebrating || lastCelebratedWord === word) return;
    if (flowPhase !== FLOW_PHASES.PLAYING) return;
    if (!transitionFlow(FLOW_PHASES.CELEBRATING)) return;

    setState({ celebrating: true, lastCelebratedWord: word });
    const sequence = narrationFlow.start('celebration');

    try {
      await wait(1000, sequence.signal);
      if (!sequence.isCurrent()) return;
      audio.playSfx('celebration');
      await wait(1000, sequence.signal);
      if (!sequence.isCurrent()) return;
      await maybePlayEncouragement(sequence);
      if (!sequence.isCurrent()) return;
      await runRecordedLetterSequence(word, { sequence });
      if (!sequence.isCurrent()) return;
      await wait(800, sequence.signal);
      if (!sequence.isCurrent()) return;
      const nextWord = game.nextWord();
      startNewWord(nextWord);
    } finally {
      setState({ celebrating: false });
    }
  }

  async function runSpellingSequence(word, { includeInitialWord = true, sequence } = {}) {
    if (!word || !isSequenceActive(sequence)) return;

    await sayWordWithPhrase(word, { highlight: includeInitialWord, sequence });
    if (!isSequenceActive(sequence)) return;

    const letters = word.split('');
    for (let i = 0; i < letters.length; i++) {
      setState({ activeCelebrationSlot: i });
      const { durationMs, bufferMs } = await audio.playLetter(letters[i]);
      await wait(durationMs + bufferMs, sequence?.signal);
      if (!isSequenceActive(sequence)) return;
      setState({ activeCelebrationSlot: -1 });
    }

    setState({ wordHighlightActive: true });
    const { durationMs: wordDuration } = await audio.playWord(word, {
      rate: 0.78,
      text: `${word}.`
    });
    await wait(wordDuration, sequence?.signal);
    if (!isSequenceActive(sequence)) return;
    setState({ wordHighlightActive: false });
    await wait(150, sequence?.signal);
  }

  async function runRecordedLetterSequence(word, { sequence } = {}) {
    if (!word || !isSequenceActive(sequence)) return;

    const sequenceLetters = getPlacedLetterSequence(word);
    for (let i = 0; i < sequenceLetters.length; i++) {
      const { char, slotIndex } = sequenceLetters[i];
      setState({ activeCelebrationSlot: slotIndex });
      const { durationMs, bufferMs } = await audio.playLetter(char);
      await wait(durationMs + bufferMs, sequence?.signal);
      if (!isSequenceActive(sequence)) return;
      setState({ activeCelebrationSlot: -1 });
    }

    setState({ wordHighlightActive: true });
    const { durationMs: wordDuration } = await audio.playWord(word, { rate: 0.75 });
    await wait(wordDuration, sequence?.signal);
    if (!isSequenceActive(sequence)) return;
    setState({ wordHighlightActive: false });
    await wait(150, sequence?.signal);
  }

  async function maybePlayEncouragement(sequence) {
    const completedCount = get(game).wordsCompleted;
    if (completedCount < 1) return;
    if ((completedCount - 1) % ENCOURAGEMENT_EVERY !== 0) return;
    const { durationMs, bufferMs } = await audio.playPhrase('encouragement');
    if (durationMs) {
      await wait(durationMs + bufferMs, sequence?.signal);
    }
  }

  function getPlacedLetterSequence(word) {
    const current = get(game);
    const slotsWithIndex = (current.slots || []).map((slot, index) => ({
      ...slot,
      index
    }));

    const orderedSlots = slotsWithIndex.sort((a, b) => {
      if (a.x === b.x) return a.y - b.y;
      return a.x - b.x;
    });

    const screenOrder = orderedSlots
      .map(slot => current.letters.find(letter => letter.id === slot.letterId))
      .filter(Boolean)
      .map(letter => ({
        char: letter.char,
        slotIndex: letter.slotIndex ?? letter.correctSlotIndex
      }));

    if (screenOrder.length) {
      return screenOrder;
    }

    return word.split('').map((char, i) => ({ char, slotIndex: i }));
  }

  return {
    subscribe: state.subscribe,
    setLayout,
    handleTapToStart,
    handleSlotsReady,
    triggerCelebrationSequence
  };
}
