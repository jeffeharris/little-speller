<script>
  import { createEventDispatcher } from 'svelte';
  import { spring } from 'svelte/motion';
  import { speakLetter } from '$lib/utils/speech.js';
  import { resumeAudio } from '$lib/utils/sounds.js';

  export let letter;
  export let placed = false;

  const dispatch = createEventDispatcher();

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let justPlaced = false;
  let wasPlaced = false;

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
    if (placed) return;

    e.preventDefault();
    e.stopPropagation();

    // Resume audio context on first interaction
    resumeAudio();

    isDragging = true;

    // Store offset from pointer to element's top-left corner
    dragOffset = {
      x: e.clientX - $position.x,
      y: e.clientY - $position.y
    };

    // Speak the letter
    speakLetter(letter.char);

    // Capture pointer for smooth dragging
    e.currentTarget.setPointerCapture(e.pointerId);

    dispatch('dragstart', { letter });
  }

  function handlePointerMove(e) {
    if (!isDragging || placed) return;

    e.preventDefault();

    // Position element so the grab point stays under the finger
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    position.set({ x: newX, y: newY }, { hard: true });

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

    dispatch('dragend', { letter, x: $position.x, y: $position.y });
  }
</script>

<div
  class="letter"
  class:dragging={isDragging}
  class:placed
  class:wiggle={justPlaced}
  style="
    left: {$position.x}px;
    top: {$position.y}px;
    background-color: {letter.color};
    z-index: {isDragging ? 100 : placed ? 50 : 10};
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
    width: 70px;
    height: 70px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    cursor: grab;
    touch-action: none;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }

  .letter:active,
  .letter.dragging {
    cursor: grabbing;
    transform: scale(1.1);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  }

  .letter.placed {
    cursor: default;
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .letter.wiggle {
    animation: wiggle 0.4s ease-out;
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
