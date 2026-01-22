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
  const flowerStems = Array.from({ length: 100 }, (_, i) => {
    const phase = i * 1.7;
    const height = 4.5 + (Math.sin(phase) + 1) * 2.2;
    return {
      x: i,
      height,
      delay: (i % 10) * 0.35
    };
  });

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
  async function handleTapToStart() {
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
    const greetingDuration = await playGreeting();
    if (greetingDuration) {
      initialGreetingPlaying = true;
      wait(greetingDuration + GREETING_BUFFER).then(() => {
        initialGreetingPlaying = false;
        startNewWord(word);
      });
    } else {
      initialGreetingPlaying = true;
      speak('Hello, little speller!', 0.82).then(() => {
        initialGreetingPlaying = false;
        startNewWord(word);
      });
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
    const completedCount = $game.wordsCompleted;
    if (completedCount < 1) return;
    if ((completedCount - 1) % ENCOURAGEMENT_EVERY !== 0) return;
    const duration = playEncouragement();
    if (duration) {
      await wait(duration + ENCOURAGEMENT_BUFFER);
    }
  }

  function getPlacedLetterSequence(word) {
    const slotsWithIndex = ($game.slots || []).map((slot, index) => ({
      ...slot,
      index
    }));

    const orderedSlots = slotsWithIndex.sort((a, b) => {
      if (a.x === b.x) return a.y - b.y;
      return a.x - b.x;
    });

    const screenOrder = orderedSlots
      .map(slot => $game.letters.find(letter => letter.id === slot.letterId))
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
    >
      <div class="loading-screen">
        <div class="loading-butterflies" aria-hidden="true">
          <span class="butterfly butterfly-1"></span>
          <span class="butterfly butterfly-2"></span>
          <span class="butterfly butterfly-3"></span>
          <span class="butterfly butterfly-4"></span>
          <span class="butterfly butterfly-5"></span>
          <span class="butterfly butterfly-6"></span>
        </div>
        <div class="loading-sun"></div>
        <div class="loading-birds" aria-hidden="true">
          <span class="bird bird-1"></span>
          <span class="bird bird-2"></span>
          <span class="bird bird-3"></span>
        </div>
        <div class="loading-cloud loading-cloud-left"></div>
        <div class="loading-cloud loading-cloud-right"></div>
        <div class="loading-cloud loading-cloud-mid"></div>
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
        <div class="loading-start">Tap to start</div>
        <div class="loading-floor"></div>
        <div class="loading-flowers" aria-hidden="true">
          {#each flowerStems as flower}
            <span
              class="flower"
              style="
                --x: {flower.x};
                --h: {flower.height};
                --delay: {flower.delay};
              "
            >
              <span class="leaf"></span>
            </span>
          {/each}
        </div>
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
    top: 68%;
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
    animation: drift 70s linear infinite;
  }

  .loading-cloud-right {
    top: 120px;
    left: 36%;
    animation: drift 90s linear infinite;
    animation-delay: -18s;
  }

  .loading-cloud-mid {
    top: 170px;
    left: 62%;
    transform: scale(0.85);
    animation: drift 80s linear infinite;
    animation-delay: -36s;
  }

  .loading-butterflies {
    position: absolute;
    top: 72vh;
    left: 0;
    width: 100%;
    height: 28vh;
    pointer-events: none;
    z-index: 2;
  }

  .butterfly {
    position: absolute;
    width: 40px;
    height: 20px;
    opacity: 0.85;
    filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.12));
    transform: scale(var(--bird-scale, 1));
  }

  .butterfly::before,
  .butterfly::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 0;
    border-top: 4px solid currentColor;
  }

  .butterfly::before {
    left: 50%;
    top: 8px;
    transform-origin: right center;
    transform: translateX(-100%) rotate(-18deg);
    animation: flap-left 1.2s ease-in-out infinite;
  }

  .butterfly::after {
    right: 50%;
    top: 8px;
    transform-origin: left center;
    transform: rotate(18deg);
    animation: flap-right 1.2s ease-in-out infinite;
  }

  .butterfly-1 {
    top: 10px;
    --bird-scale: 0.95;
    color: #ff6b6b;
    animation: flutter-1 60s ease-in-out infinite;
  }

  .butterfly-2 {
    top: 58px;
    --bird-scale: 0.75;
    opacity: 0.7;
    color: #4d96ff;
    animation: flutter-2 68s ease-in-out infinite;
  }

  .butterfly-3 {
    top: 32px;
    --bird-scale: 0.85;
    opacity: 0.65;
    color: #ff9b85;
    animation: flutter-3 62s ease-in-out infinite;
  }

  .butterfly-4 {
    top: 84px;
    --bird-scale: 0.7;
    opacity: 0.6;
    color: #ffd166;
    animation: flutter-4 72s ease-in-out infinite;
  }

  .butterfly-5 {
    top: 18px;
    --bird-scale: 0.8;
    opacity: 0.7;
    color: #8fd3ff;
    animation: flutter-5 58s ease-in-out infinite;
  }

  .butterfly-6 {
    top: 110px;
    --bird-scale: 0.65;
    opacity: 0.55;
    color: #cdb4f6;
    animation: flutter-6 78s ease-in-out infinite;
  }

  .loading-birds {
    position: absolute;
    top: 8vh;
    left: 0;
    width: 100%;
    height: 18vh;
    pointer-events: none;
    z-index: 3;
  }

  .bird {
    position: absolute;
    width: 3.6rem;
    height: 1.4rem;
    border-top: 0.3rem solid #1f3c40;
    border-radius: 50% 50% 0 0;
    opacity: 0.75;
    animation: bird-fly 50s linear infinite;
  }

  .bird::after {
    content: '';
    position: absolute;
    right: -1.4rem;
    top: -0.06rem;
    width: 3.6rem;
    height: 1.4rem;
    border-top: 0.3rem solid #1f3c40;
    border-radius: 50% 50% 0 0;
    transform: scaleX(-1);
  }

  .bird-1 { top: 0.6rem; left: -20%; animation-delay: -6s; }
  .bird-2 { top: 3.4rem; left: -30%; animation-delay: -18s; opacity: 0.6; }
  .bird-3 { top: 1.9rem; left: -25%; animation-delay: -30s; opacity: 0.55; }

  .loading-arc {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(96vw, 52rem);
    height: 28vh;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 8vw;
    pointer-events: none;
  }

  .loading-arc span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    height: auto;
    margin: 0 0.35rem;
    padding: 0 0.12rem;
    font-size: clamp(5.184rem, 15.552vw, 12.96rem);
    font-weight: 900;
    color: #1d3557;
    animation: pop 1.8s ease-in-out infinite;
  }

  .loading-arc-top {
    top: calc(40% - 12vh);
  }

  .loading-arc-bottom {
    top: calc(45% + 9vh);
    width: min(94vw, 42rem);
    height: 22vh;
  }

  .loading-arc span:nth-child(1) { color: #ff6b6b; animation-delay: 0s; }
  .loading-arc span:nth-child(2) { color: #f4a261; animation-delay: 0.1s; }
  .loading-arc span:nth-child(3) { color: #f9c74f; animation-delay: 0.2s; }
  .loading-arc span:nth-child(4) { color: #90be6d; animation-delay: 0.3s; }
  .loading-arc span:nth-child(5) { color: #4d96ff; animation-delay: 0.4s; }
  .loading-arc span:nth-child(6) { color: #9b5de5; animation-delay: 0.5s; }
  .loading-arc span:nth-child(7) { color: #ff6fae; animation-delay: 0.6s; }


  .loading-start {
    position: absolute;
    bottom: 25%;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1d3557;
    background: #bde0fe;
    padding: 0.6rem 1.4rem;
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

  .loading-flowers {
    position: absolute;
    bottom: 8px;
    left: 0;
    width: 100%;
    height: 12vh;
    pointer-events: none;
  }

  .flower {
    position: absolute;
    bottom: 0;
    left: calc(var(--x) * 1%);
    width: 0.35rem;
    height: calc(var(--h) * 1vh);
    background: linear-gradient(180deg, #5bb673 0%, #3f8f57 100%);
    border-radius: 999px;
    transform-origin: bottom center;
    animation: sway 5s ease-in-out infinite;
    animation-delay: calc(var(--delay) * 1s);
  }

  .flower .leaf {
    position: absolute;
    left: 50%;
    top: 40%;
    width: 0.8rem;
    height: 0.5rem;
    background: linear-gradient(180deg, #63c77a 0%, #3d9b5a 100%);
    border-radius: 0.8rem 0.8rem 0.1rem 0.8rem;
    transform: translateX(-80%) rotate(-22deg);
    opacity: 0;
  }

  .flower:nth-child(3n) .leaf {
    opacity: 0.9;
  }

  .flower:nth-child(5n) .leaf {
    transform: translateX(-10%) rotate(18deg) scaleX(-1);
    opacity: 0.8;
  }

  .flower::before,
  .flower::after {
    content: '';
    position: absolute;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    top: -0.5rem;
    left: 50%;
    transform: translateX(-50%);
  }

  .flower::before {
    background: #fbd1e6;
    box-shadow:
      0.7rem 0.3rem 0 #ffd166,
      -0.7rem 0.3rem 0 #ff9b85,
      0 0.8rem 0 #ffe08a,
      0.7rem -0.2rem 0 #cdb4f6,
      -0.7rem -0.2rem 0 #8fd3ff,
      0 1rem 0 #ffe6a7,
      0.85rem 0.6rem 0 #ffb5c5;
  }

  .flower::after {
    width: 0.3rem;
    height: 0.3rem;
    background: #ff6b6b;
    top: -0.12rem;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @keyframes drift {
    0% { transform: translateX(-140%); }
    100% { transform: translateX(140%); }
  }

  @keyframes floaty {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(10px); }
  }

  @keyframes flutter-1 {
    0% { transform: translate(-40vw, 6vh) scale(var(--bird-scale)); }
    14% { transform: translate(2vw, 1vh) scale(var(--bird-scale)); }
    28% { transform: translate(16vw, 9vh) scale(var(--bird-scale)); }
    38% { transform: translate(12vw, 20vh) scale(var(--bird-scale)); }
    48% { transform: translate(12vw, 20vh) scale(var(--bird-scale)); }
    66% { transform: translate(44vw, 8vh) scale(var(--bird-scale)); }
    80% { transform: translate(74vw, 18vh) scale(var(--bird-scale)); }
    90% { transform: translate(60vw, 14vh) scale(var(--bird-scale)) scaleX(-1); }
    100% { transform: translate(-40vw, 10vh) scale(var(--bird-scale)) scaleX(-1); }
  }

  @keyframes flutter-2 {
    0% { transform: translate(130vw, 10vh) scale(var(--bird-scale)) scaleX(-1); }
    18% { transform: translate(96vw, 2vh) scale(var(--bird-scale)) scaleX(-1); }
    34% { transform: translate(70vw, 14vh) scale(var(--bird-scale)) scaleX(-1); }
    44% { transform: translate(70vw, 24vh) scale(var(--bird-scale)) scaleX(-1); }
    56% { transform: translate(70vw, 24vh) scale(var(--bird-scale)) scaleX(-1); }
    72% { transform: translate(34vw, 6vh) scale(var(--bird-scale)) scaleX(-1); }
    86% { transform: translate(8vw, 18vh) scale(var(--bird-scale)) scaleX(-1); }
    100% { transform: translate(130vw, 12vh) scale(var(--bird-scale)); }
  }

  @keyframes flutter-3 {
    0% { transform: translate(-30vw, 9vh) scale(var(--bird-scale)); }
    18% { transform: translate(6vw, 0vh) scale(var(--bird-scale)); }
    34% { transform: translate(24vw, 12vh) scale(var(--bird-scale)); }
    46% { transform: translate(24vw, 22vh) scale(var(--bird-scale)); }
    58% { transform: translate(24vw, 22vh) scale(var(--bird-scale)); }
    72% { transform: translate(56vw, 10vh) scale(var(--bird-scale)); }
    86% { transform: translate(80vw, 20vh) scale(var(--bird-scale)); }
    100% { transform: translate(140vw, 12vh) scale(var(--bird-scale)); }
  }

  @keyframes flutter-4 {
    0% { transform: translate(120vw, 16vh) scale(var(--bird-scale)) scaleX(-1); }
    18% { transform: translate(84vw, 6vh) scale(var(--bird-scale)) scaleX(-1); }
    36% { transform: translate(56vw, 16vh) scale(var(--bird-scale)) scaleX(-1); }
    50% { transform: translate(56vw, 26vh) scale(var(--bird-scale)) scaleX(-1); }
    62% { transform: translate(56vw, 26vh) scale(var(--bird-scale)) scaleX(-1); }
    78% { transform: translate(26vw, 10vh) scale(var(--bird-scale)) scaleX(-1); }
    92% { transform: translate(6vw, 22vh) scale(var(--bird-scale)) scaleX(-1); }
    100% { transform: translate(120vw, 18vh) scale(var(--bird-scale)); }
  }

  @keyframes flutter-5 {
    0% { transform: translate(-35vw, 6vh) scale(var(--bird-scale)); }
    16% { transform: translate(0vw, 12vh) scale(var(--bird-scale)); }
    32% { transform: translate(18vw, 4vh) scale(var(--bird-scale)); }
    46% { transform: translate(18vw, 18vh) scale(var(--bird-scale)); }
    58% { transform: translate(18vw, 18vh) scale(var(--bird-scale)); }
    74% { transform: translate(54vw, 12vh) scale(var(--bird-scale)); }
    88% { transform: translate(82vw, 6vh) scale(var(--bird-scale)); }
    100% { transform: translate(140vw, 14vh) scale(var(--bird-scale)); }
  }

  @keyframes flutter-6 {
    0% { transform: translate(-45vw, 18vh) scale(var(--bird-scale)); }
    20% { transform: translate(6vw, 22vh) scale(var(--bird-scale)); }
    36% { transform: translate(24vw, 12vh) scale(var(--bird-scale)); }
    50% { transform: translate(24vw, 26vh) scale(var(--bird-scale)); }
    62% { transform: translate(24vw, 26vh) scale(var(--bird-scale)); }
    78% { transform: translate(58vw, 18vh) scale(var(--bird-scale)); }
    92% { transform: translate(84vw, 10vh) scale(var(--bird-scale)); }
    100% { transform: translate(140vw, 20vh) scale(var(--bird-scale)); }
  }

  @keyframes bird-fly {
    0% { transform: translateX(-20%); }
    100% { transform: translateX(140%); }
  }

  @keyframes flap-left {
    0%, 100% { transform: translateX(-100%) rotate(-26deg); }
    50% { transform: translateX(-100%) rotate(-6deg); }
  }

  @keyframes flap-right {
    0%, 100% { transform: rotate(26deg); }
    50% { transform: rotate(6deg); }
  }

  @keyframes sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
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
