<script>
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let word = '';

  let stars = [];

  onMount(() => {
    // Generate random stars for celebration
    stars = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 30,
      delay: Math.random() * 0.5,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)]
    }));
  });
</script>

<div class="celebration" transition:fade={{ duration: 300 }}>
  {#each stars as star (star.id)}
    <div
      class="star"
      style="
        left: {star.x}%;
        top: {star.y}%;
        font-size: {star.size}px;
        animation-delay: {star.delay}s;
        color: {star.color};
      "
    >
      ★
    </div>
  {/each}

  <div class="message" in:scale={{ duration: 400, delay: 100 }}>
    <div class="word">{word.toUpperCase()}</div>
    <div class="hooray">Great job!</div>
  </div>
</div>

<style>
  .celebration {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 200;
  }

  .star {
    position: absolute;
    animation: twinkle 0.6s ease-in-out infinite alternate;
  }

  @keyframes twinkle {
    from {
      transform: scale(0.8) rotate(-10deg);
      opacity: 0.6;
    }
    to {
      transform: scale(1.2) rotate(10deg);
      opacity: 1;
    }
  }

  .message {
    text-align: center;
    z-index: 10;
  }

  .word {
    font-size: 64px;
    font-weight: bold;
    color: #4ECDC4;
    text-shadow: 3px 3px 0 #45B7D1, 6px 6px 0 rgba(0, 0, 0, 0.1);
    letter-spacing: 8px;
  }

  .hooray {
    font-size: 32px;
    color: #FF6B6B;
    margin-top: 16px;
    font-weight: bold;
  }
</style>
