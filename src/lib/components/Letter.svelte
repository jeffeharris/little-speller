<script>
  import { createEventDispatcher } from 'svelte';
  import { spring } from 'svelte/motion';
  import { speakLetter } from '$lib/utils/speech.js';
  import { resumeAudio, playLetterSound } from '$lib/utils/sounds.js';

  export let letter;
  export let placed = false;
  export let highlighted = false;
  export let wordHighlight = false;
  export let interactable = true;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let justPlaced = false;
  let wasPlaced = false;
  let lastPointer = { x: 0, y: 0 };
  let lastTimestamp = 0;
  let velocity = { x: 0, y: 0 };

  // Detect when letter becomes placed and trigger wiggle
  $: if (placed && !wasPlaced) {
    wasPlaced = true;
    justPlaced = true;
    setTimeout(() => {
      justPlaced = false;
    }, 400);
  }

  // Spring for smooth position animation
  const position = spring(
    { x: letter.x, y: letter.y },
    { stiffness: 0.2, damping: 0.7 }
  );

  // Update spring target when letter position changes
  $: if (!isDragging) {
    position.set({ x: letter.x, y: letter.y });
  }

  function handlePointerDown(e) {
    if (placed || !interactable) return;

    e.preventDefault();
    e.stopPropagation();

    // Resume audio context on first interaction
    resumeAudio();

    isDragging = true;
    velocity = { x: 0, y: 0 };
    lastPointer = { x: e.clientX, y: e.clientY };
    lastTimestamp = e.timeStamp;

    // Store offset from pointer to element's top-left corner
    dragOffset = {
      x: e.clientX - $position.x,
      y: e.clientY - $position.y
    };

    // Play recorded narration, fall back to TTS if needed
    const clipDuration = playLetterSound(letter.char);
    if (!clipDuration) {
      speakLetter(letter.char);
    }

    // Capture pointer for smooth dragging
    e.currentTarget.setPointerCapture(e.pointerId);

    dispatch('dragstart', { letter, x: $position.x, y: $position.y });
  }

  function handlePointerMove(e) {
    if (!isDragging || placed) return;

    e.preventDefault();

    // Position element so the grab point stays under the finger
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    position.set({ x: newX, y: newY }, { hard: true });

    const dt = e.timeStamp - lastTimestamp;
    if (dt > 0) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      const nextVelocity = { x: dx / dt, y: dy / dt };
      velocity = {
        x: velocity.x * 0.65 + nextVelocity.x * 0.35,
        y: velocity.y * 0.65 + nextVelocity.y * 0.35
      };
      lastPointer = { x: e.clientX, y: e.clientY };
      lastTimestamp = e.timeStamp;
    }

    dispatch('drag', { letter, x: newX, y: newY });
  }

  function handlePointerUp(e) {
    if (!isDragging) return;

    isDragging = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may have been lost
    }

    dispatch('dragend', {
      letter,
      x: $position.x,
      y: $position.y,
      velocity: { ...velocity }
    });
  }
</script>

<div
  class="letter"
  class:dragging={isDragging}
  class:placed
  class:wiggle={justPlaced}
  class:highlighted-letter={highlighted}
  class:word-highlight={wordHighlight}
  style="
    left: {$position.x}px;
    top: {$position.y}px;
    background-color: {letter.color};
    z-index: {isDragging ? 100 : wordHighlight ? 90 : placed ? 50 : 10};
  "
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerUp}
  role="button"
  tabindex="0"
>
  {letter.char.toUpperCase()}
</div>

<style>
  .letter {
    position: absolute;
    width: var(--letter-size, 70px);
    height: var(--letter-size, 70px);
    border-radius: var(--letter-radius, 12px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--letter-font-size, 42px);
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    cursor: grab;
    touch-action: none;
    transition: transform 0.2s ease, box-shadow 0.1s ease;
    transform: translateZ(var(--letter-z, 0px)) scale(var(--letter-scale, 1));
    will-change: transform;
    transform-style: preserve-3d;
  }

  .letter:active,
  .letter.dragging {
    cursor: grabbing;
    --letter-scale: 1.1;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  }

  .letter.placed {
    cursor: default;
    --letter-scale: 1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .letter.wiggle {
    animation: wiggle 0.4s ease-out;
  }

  .letter.highlighted-letter {
    --letter-scale: 1.3;
    --letter-z: 160px;
  }

  .letter.word-highlight {
    --letter-z: 90px;
    --letter-scale: 1.12;
  }


  @keyframes wiggle {
    0% {
      transform: scale(1.15);
    }
    25% {
      transform: scale(1) rotate(-8deg);
    }
    50% {
      transform: scale(1.05) rotate(6deg);
    }
    75% {
      transform: scale(1) rotate(-3deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
</style>
