<script>
  import { onMount, createEventDispatcher } from 'svelte';

  export let word = '';
  export let slots = [];

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

<div class="word-container" bind:this={containerEl}>
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
    gap: 8px;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .slot {
    width: 70px;
    height: 70px;
    border-radius: 12px;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .ghost-letter {
    font-size: 42px;
    font-weight: bold;
    color: #d0d0d0;
    user-select: none;
  }

  .slot.filled .ghost-letter {
    visibility: hidden;
  }
</style>
