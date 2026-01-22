<script>
  import { onMount, createEventDispatcher } from 'svelte';

  export let word = '';
  export let slots = [];
  export let wordHighlight = false;

  const dispatch = createEventDispatcher();

  let containerEl;
  let slotEls = [];

  onMount(() => {
    updateSlotPositions();
  });

  function updateSlotPositions() {
    if (!containerEl || slotEls.length === 0) return;

    const containerRect = containerEl.getBoundingClientRect();
    const positions = slotEls.map(el => {
      if (!el) return { x: 0, y: 0, width: 70, height: 70 };
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    });

    dispatch('slotsready', { positions });
  }

  $: if (word && containerEl) {
    // Wait for DOM update then measure
    requestAnimationFrame(updateSlotPositions);
  }
</script>

<div
  class="word-container"
  class:word-highlight={wordHighlight}
  bind:this={containerEl}
>
  {#each word.split('') as char, i}
    <div
      class="slot"
      class:filled={slots[i]?.filled}
      bind:this={slotEls[i]}
    >
      <span class="ghost-letter">{char.toUpperCase()}</span>
    </div>
  {/each}
</div>

<style>
  .word-container {
    display: flex;
    gap: calc(var(--letter-size, 70px) * 0.12);
    justify-content: center;
    align-items: center;
    padding: calc(var(--letter-size, 70px) * 0.28);
    transition: transform 0.25s ease;
    transform-origin: center bottom;
  }

  .word-container.word-highlight {
    transform: none;
    filter: none;
  }

  .word-container.word-highlight .slot {
    opacity: 0;
  }

  .slot {
    width: var(--letter-size, 70px);
    height: var(--letter-size, 70px);
    border-radius: var(--letter-radius, 12px);
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .ghost-letter {
    font-size: var(--letter-font-size, 42px);
    font-weight: bold;
    color: #d0d0d0;
    user-select: none;
  }

  .slot.filled .ghost-letter {
    visibility: hidden;
  }
</style>
