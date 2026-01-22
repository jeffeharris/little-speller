<script>
  import { onMount } from 'svelte';
  import { game } from '$lib/stores/game.js';
  import { initSpeech, speak, speakLetter, speakWord } from '$lib/utils/speech.js';
  import { playPop, playCelebration, playThud, resumeAudio, playLetterSound, playIsSpelled, playGreeting, playEncouragement } from '$lib/utils/sounds.js';
  import Letter from './Letter.svelte';
  import WordSlots from './WordSlots.svelte';
  import Celebration from './Celebration.svelte';

  let containerEl;
  let containerWidth = 0;
  let containerHeight = 0;
  let isLandscape = false;
  let wordCenterX = 0;
  let wordCenterY = 0;
  let slotPositions = [];
  let waitingForTap = true;  // iOS requires user gesture to unlock audio
  let celebrating = false;
  let activeCelebrationSlot = -1;
  let wordHighlightActive = false;
  let lastCelebratedWord = '';
  let introRunning = false;
  let introCompletedWord = '';
  let slotsReadyForWord = false;
  let initialGreetingPlaying = false;

  let snapDistance = 60;
  let halfLetter = 35;
  let letterFontSize = 42;
  let letterRadius = 12;
  const LETTER_MIN_DURATION = 350;
  $: if ($game.letterSize) {
    const size = $game.letterSize;
    snapDistance = size * 0.85;
    halfLetter = size / 2;
    letterFontSize = Math.round(size * 0.6);
    letterRadius = Math.max(10, Math.round(size * 0.17));
  }
  const WORD_MIN_DURATION = 500;
  const IS_SPELLED_DELAY = 900;
  const IS_SPELLED_BUFFER = 250;
  const LETTER_BUFFER_AFTER = 220;
  const GREETING_BUFFER = 350;
  const ENCOURAGEMENT_EVERY = 3;
  const ENCOURAGEMENT_BUFFER = 250;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function sayWordWithPhrase(word, { highlight = false } = {}) {
    if (highlight) {
      wordHighlightActive = true;
    }
    await Promise.all([
      speakWord(word),
      wait(WORD_MIN_DURATION)
    ]);
    if (highlight) {
      wordHighlightActive = false;
    }
    await wait(150);
    const phraseDuration = playIsSpelled();
    const phraseWait = phraseDuration
      ? phraseDuration + IS_SPELLED_BUFFER
      : IS_SPELLED_DELAY;
    await wait(phraseWait);
  }

  onMount(() => {
    initSpeech();
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);

    return () => {
      window.removeEventListener('resize', updateContainerSize);
    };
  });

  function updateContainerSize() {
    if (containerEl) {
      containerWidth = containerEl.clientWidth;
      containerHeight = containerEl.clientHeight;
      isLandscape = containerWidth > containerHeight;
    }
  }

  // Called on user tap - unlocks audio on iOS
  function handleTapToStart() {
    if (!waitingForTap) return;
    waitingForTap = false;

    // Unlock audio context (iOS requires this from user gesture)
    resumeAudio();

    // Unlock speech synthesis by speaking from user gesture
    // This empty utterance unlocks iOS speech
    if (window.speechSynthesis) {
      const unlock = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(unlock);
    }

    game.setPhase('showing');

    const word = game.getNextWord();
    const greetingDuration = playGreeting();
    if (greetingDuration) {
      initialGreetingPlaying = true;
      wait(greetingDuration + GREETING_BUFFER).then(() => {
        initialGreetingPlaying = false;
        startNewWord(word);
      });
    } else {
      initialGreetingPlaying = false;
      startNewWord(word);
    }
  }

  function startNewWord(word) {
    lastCelebratedWord = '';
    activeCelebrationSlot = -1;
    wordHighlightActive = false;
    introCompletedWord = '';
    slotsReadyForWord = false;
    game.initWord(word, containerWidth, containerHeight, { isLandscape });

    // Letter tiles start in their slots; intro narration will scatter after completion
  }

  function handleSlotsReady(e) {
    slotPositions = e.detail.positions;
    game.setSlotPositions(slotPositions);
    slotsReadyForWord = true;
    updateWordCenter(slotPositions);

    if ($game.phase === 'showing') {
      game.showWordInSlots();
      startIntroSequence($game.currentWord);
    }
  }

  function getLetterBounds() {
    const size = $game.letterSize || 70;
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, containerWidth - size),
      maxY: Math.max(0, containerHeight - size)
    };
  }

  function handleDragStart(e) {
    const { letter, x, y } = e.detail;
    game.updateLetterPosition(letter.id, x, y);
  }

  function updateWordCenter(positions) {
    if (!positions || positions.length === 0) {
      wordCenterX = containerWidth / 2;
      wordCenterY = containerHeight / 2;
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    positions.forEach(pos => {
      const centerX = pos.x + pos.width / 2;
      const centerY = pos.y + pos.height / 2;
      minX = Math.min(minX, centerX);
      maxX = Math.max(maxX, centerX);
      minY = Math.min(minY, centerY);
      maxY = Math.max(maxY, centerY);
    });

    wordCenterX = (minX + maxX) / 2;
    wordCenterY = (minY + maxY) / 2;
  }

  function handleDragEnd(e) {
    const { letter, x, y, velocity } = e.detail;
    const letterCenterX = x + halfLetter;
    const letterCenterY = y + halfLetter;

    // Check if letter is close to any slot
    for (let i = 0; i < slotPositions.length; i++) {
      const slot = slotPositions[i];
      const slotCenterX = slot.x + slot.width / 2;
      const slotCenterY = slot.y + slot.height / 2;

      const dx = slotCenterX - letterCenterX;
      const dy = slotCenterY - letterCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < snapDistance && !$game.slots[i].filled) {
        // Check if letter matches this slot's character
        const isMatch = letter.char.toLowerCase() === $game.slots[i].char.toLowerCase();

        game.placeLetter(letter.id, i);

        if (isMatch) {
          playPop();
        } else {
          playThud();
        }
        return;
      }
    }

    // Not close to any slot - update position where dropped
    if (velocity) {
      game.applyMomentum(letter.id, { x, y }, velocity, getLetterBounds());
    } else {
      game.updateLetterPosition(letter.id, x, y);
    }
  }

  // Watch for celebration phase
  $: if ($game.phase === 'celebrating') {
    triggerCelebrationSequence($game.currentWord);
  }

  async function startIntroSequence(word) {
    if (
      !word ||
      !slotsReadyForWord ||
      introRunning ||
      introCompletedWord === word ||
      $game.phase !== 'showing' ||
      initialGreetingPlaying
    ) return;

    introRunning = true;
    activeCelebrationSlot = -1;
    wordHighlightActive = false;

    await runSpellingSequence(word, { includeInitialWord: true });

    introCompletedWord = word;
    introRunning = false;

    setTimeout(() => {
      activeCelebrationSlot = -1;
      wordHighlightActive = false;
      game.scatterLetters();
    }, 200);
  }

  async function triggerCelebrationSequence(word) {
    if (!word || celebrating || lastCelebratedWord === word) return;

    celebrating = true;
    lastCelebratedWord = word;

    await wait(1000);
    playCelebration();
    await wait(1000);
    await maybePlayEncouragement();
    await runRecordedLetterSequence(word);

    celebrating = false;

    setTimeout(() => {
      const nextWord = game.nextWord();
      startNewWord(nextWord);
    }, 800);
  }

  async function runSpellingSequence(word, { includeInitialWord = true } = {}) {
    if (!word) return;

    await sayWordWithPhrase(word, { highlight: includeInitialWord });


    const letters = word.split('');
    for (let i = 0; i < letters.length; i++) {
      activeCelebrationSlot = i;
      const clipDuration = playLetterSound(letters[i]);
      if (clipDuration) {
        await wait(clipDuration + LETTER_BUFFER_AFTER);
      } else {
        await Promise.all([
          speakLetter(letters[i]),
          wait(LETTER_MIN_DURATION)
        ]);
        await wait(LETTER_BUFFER_AFTER);
      }
      activeCelebrationSlot = -1;
    }

    wordHighlightActive = true;
    await Promise.all([
      speak(`${word}.`, 0.78),
      wait(WORD_MIN_DURATION)
    ]);
    wordHighlightActive = false;
    await wait(150);
  }

  async function runRecordedLetterSequence(word) {
    if (!word) return;

    const sequence = getPlacedLetterSequence(word);
    for (let i = 0; i < sequence.length; i++) {
      const { char, slotIndex } = sequence[i];
      activeCelebrationSlot = slotIndex;
      const clipDuration = playLetterSound(char);
      if (clipDuration) {
        await wait(clipDuration + LETTER_BUFFER_AFTER);
      } else {
        await Promise.all([
          speakLetter(char),
          wait(LETTER_MIN_DURATION)
        ]);
        await wait(LETTER_BUFFER_AFTER);
      }
      activeCelebrationSlot = -1;
    }

    wordHighlightActive = true;
    await Promise.all([
      speakWord(word),
      wait(WORD_MIN_DURATION)
    ]);
    wordHighlightActive = false;
    await wait(150);
  }

  async function maybePlayEncouragement() {
    const completedCount = $game.wordsCompleted + 1;
    if (completedCount % ENCOURAGEMENT_EVERY !== 0) return;
    const duration = playEncouragement();
    if (duration) {
      await wait(duration + ENCOURAGEMENT_BUFFER);
    }
  }

  function getPlacedLetterSequence(word) {
    const placedOrder = ($game.placementOrder || [])
      .map(letterId => $game.letters.find(l => l.id === letterId))
      .filter(Boolean)
      .map(letter => ({
        char: letter.char,
        slotIndex: letter.slotIndex ?? letter.correctSlotIndex
      }));

    if (placedOrder.length) {
      return placedOrder;
    }

    return word.split('').map((char, i) => ({ char, slotIndex: i }));
  }
</script>

<div
  class="game-container"
  class:landscape={isLandscape}
  style="
    --letter-size: {$game.letterSize || 70}px;
    --letter-font-size: {letterFontSize}px;
    --letter-radius: {letterRadius}px;
  "
  bind:this={containerEl}
>
  {#if $game.phase !== 'loading'}
    <div
      class="word-stage"
      class:word-stage-highlight={wordHighlightActive}
      style="--word-center-x: {wordCenterX}px; --word-center-y: {wordCenterY}px;"
    >
      <div class="word-area">
        <WordSlots
          word={$game.currentWord}
          slots={$game.slots}
          wordHighlight={wordHighlightActive}
          on:slotsready={handleSlotsReady}
        />
      </div>

      {#if $game.phase === 'celebrating'}
        <Celebration word={$game.currentWord} />
      {/if}

      {#each $game.letters as letter (letter.id)}
        <Letter
          {letter}
          placed={letter.placed}
          highlighted={letter.correctSlotIndex === activeCelebrationSlot}
          wordHighlight={wordHighlightActive}
          interactable={$game.phase === 'playing'}
          on:dragstart={handleDragStart}
          on:dragend={handleDragEnd}
        />
      {/each}
    </div>

  {:else}
    <button
      class="loading"
      type="button"
      on:click={handleTapToStart}
      on:pointerdown={handleTapToStart}
      on:touchstart={handleTapToStart}
    >
      <div class="loading-screen">
        <div class="loading-sun"></div>
        <div class="loading-cloud loading-cloud-left"></div>
        <div class="loading-cloud loading-cloud-right"></div>
        <div class="loading-arc loading-arc-top">
          <span>L</span>
          <span>I</span>
          <span>T</span>
          <span>T</span>
          <span>L</span>
          <span>E</span>
        </div>
        <div class="loading-arc loading-arc-bottom">
          <span>S</span>
          <span>P</span>
          <span>E</span>
          <span>L</span>
          <span>L</span>
          <span>E</span>
          <span>R</span>
        </div>
        <div class="loading-board">
          <div class="loading-chips">
            <span class="chip chip-a">A</span>
            <span class="chip chip-b">B</span>
            <span class="chip chip-c">C</span>
            <span class="chip chip-d">D</span>
            <span class="chip chip-e">E</span>
            <span class="chip chip-f">F</span>
          </div>
          <div class="loading-start">Tap to start</div>
        </div>
        <div class="loading-floor"></div>
      </div>
    </button>
  {/if}

  <div class="score">
    Words: {$game.wordsCompleted}
  </div>
</div>

<style>
  .game-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
    perspective: 900px;
    perspective-origin: 50% 60%;
  }

  .word-area {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
  }

  .loading {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
  }

  .loading-screen {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #bdeeff 0%, #ffffff 60%, #f9f7e8 100%);
    font-family: 'Baloo 2', 'Comic Sans MS', 'Trebuchet MS', sans-serif;
  }

  .loading-sun {
    position: absolute;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #fff6b3 0%, #ffd166 55%, #f9b233 100%);
    top: -40px;
    right: 8%;
    box-shadow: 0 12px 30px rgba(249, 178, 51, 0.35);
    animation: floaty 6s ease-in-out infinite;
  }

  .loading-cloud {
    position: absolute;
    width: 140px;
    height: 70px;
    border-radius: 50px;
    background: #ffffff;
    box-shadow: 20px 12px 0 0 #ffffff, 40px 4px 0 0 #ffffff;
    opacity: 0.9;
  }

  .loading-cloud-left {
    top: 70px;
    left: 8%;
    animation: drift 12s ease-in-out infinite;
  }

  .loading-cloud-right {
    top: 120px;
    right: 14%;
    animation: drift 10s ease-in-out infinite reverse;
  }


  .loading-arc {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    width: min(520px, 86vw);
    height: 140px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: none;
  }

  .loading-arc span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    margin: 0 4px;
    border-radius: 50%;
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.18);
    transform-origin: 50% 120px;
    animation: pop 1.8s ease-in-out infinite;
  }

  .loading-arc-top {
    top: 14px;
  }

  .loading-arc-bottom {
    top: 78px;
    width: min(560px, 92vw);
    height: 150px;
  }

  .loading-arc span:nth-child(1) { background: #ff6b6b; transform: rotate(-26deg); animation-delay: 0s; }
  .loading-arc span:nth-child(2) { background: #f4a261; transform: rotate(-18deg); animation-delay: 0.1s; }
  .loading-arc span:nth-child(3) { background: #f9c74f; transform: rotate(-10deg); animation-delay: 0.2s; }
  .loading-arc span:nth-child(4) { background: #90be6d; transform: rotate(0deg); animation-delay: 0.3s; }
  .loading-arc span:nth-child(5) { background: #4d96ff; transform: rotate(10deg); animation-delay: 0.4s; }
  .loading-arc span:nth-child(6) { background: #9b5de5; transform: rotate(18deg); animation-delay: 0.5s; }
  .loading-arc span:nth-child(7) { background: #ff6fae; transform: rotate(26deg); animation-delay: 0.6s; }


  .loading-board {
    background: #fff7e1;
    border-radius: 24px;
    padding: 24px 32px;
    box-shadow: 0 18px 32px rgba(0, 0, 0, 0.12);
    border: 4px solid #ffe08a;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }

  .loading-chips {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .chip {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    box-shadow: 0 8px 14px rgba(0, 0, 0, 0.18);
    animation: pop 1.8s ease-in-out infinite;
  }

  .chip-a { background: #ff6b6b; }
  .chip-b { background: #f4a261; animation-delay: 0.1s; }
  .chip-c { background: #f9c74f; animation-delay: 0.2s; }
  .chip-d { background: #90be6d; animation-delay: 0.3s; }
  .chip-e { background: #4d96ff; animation-delay: 0.4s; }
  .chip-f { background: #9b5de5; animation-delay: 0.5s; }

  .loading-start {
    font-size: 24px;
    font-weight: 700;
    color: #1d3557;
    background: #bde0fe;
    padding: 10px 22px;
    border-radius: 999px;
    box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.12);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .loading-floor {
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 120px;
    background: radial-gradient(circle at 50% 0%, #d0f4de 0%, #f6fff8 60%);
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @keyframes pop {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-6px) scale(1.05); }
  }

  @keyframes drift {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(18px); }
  }

  @keyframes floaty {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(10px); }
  }

  .score {
    position: absolute;
    top: 20px;
    right: 20px;
    font-size: 18px;
    color: #888;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .word-stage {
    position: absolute;
    inset: 0;
    transform-origin: var(--word-center-x, 50%) var(--word-center-y, 50%);
    transition: transform 0.25s ease;
    transform-style: preserve-3d;
  }

  .word-stage.word-stage-highlight {
    transform: scale(1.18);
  }

  .game-container.landscape .word-area {
    top: 42%;
  }

  .game-container.landscape .score {
    top: 14px;
    right: 14px;
    font-size: 16px;
  }

</style>
