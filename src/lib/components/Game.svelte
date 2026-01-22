<script>
  import { onMount } from 'svelte';
  import { game, LETTER_SIZE } from '$lib/stores/game.js';
  import { initSpeech, speakWord } from '$lib/utils/speech.js';
  import { playPop, playCelebration, playThud, resumeAudio } from '$lib/utils/sounds.js';
  import Letter from './Letter.svelte';
  import WordSlots from './WordSlots.svelte';
  import Celebration from './Celebration.svelte';

  let containerEl;
  let containerWidth = 0;
  let containerHeight = 0;
  let slotPositions = [];
  let waitingForTap = true;  // iOS requires user gesture to unlock audio

  const SNAP_DISTANCE = 60;
  const HALF_LETTER = LETTER_SIZE / 2;

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
    game.initWord(word, containerWidth, containerHeight);

    // Speak the word after a brief delay
    setTimeout(() => {
      speakWord(word);

      // Start scramble animation after word is spoken
      setTimeout(() => {
        game.scatterLetters();
      }, 1000);
    }, 300);
  }

  function handleSlotsReady(e) {
    slotPositions = e.detail.positions;
    game.setSlotPositions(slotPositions);
  }

  function handleDragEnd(e) {
    const { letter, x, y } = e.detail;
    const letterCenterX = x + HALF_LETTER;
    const letterCenterY = y + HALF_LETTER;

    // Check if letter is close to any slot
    for (let i = 0; i < slotPositions.length; i++) {
      const slot = slotPositions[i];
      const slotCenterX = slot.x + slot.width / 2;
      const slotCenterY = slot.y + slot.height / 2;

      const dx = slotCenterX - letterCenterX;
      const dy = slotCenterY - letterCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < SNAP_DISTANCE && !$game.slots[i].filled) {
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
    game.updateLetterPosition(letter.id, x, y);
  }

  // Watch for celebration phase
  $: if ($game.phase === 'celebrating') {
    playCelebration();
    speakWord($game.currentWord);

    // Auto-advance after celebration
    setTimeout(() => {
      const nextWord = game.nextWord();
      startNewWord(nextWord);
    }, 2500);
  }
</script>

<div
  class="game-container"
  bind:this={containerEl}
>
  {#if $game.phase !== 'loading'}
    <div class="word-area">
      <WordSlots
        word={$game.currentWord}
        slots={$game.slots}
        on:slotsready={handleSlotsReady}
      />
    </div>

    {#each $game.letters as letter (letter.id)}
      <Letter
        {letter}
        placed={letter.placed}
        on:dragend={handleDragEnd}
      />
    {/each}

    {#if $game.phase === 'celebrating'}
      <Celebration word={$game.currentWord} />
    {/if}
  {:else}
    <button class="loading" on:click={handleTapToStart}>
      <div class="loading-text">Tap to start!</div>
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

  .loading-text {
    font-size: 32px;
    color: #888;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
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
</style>
