import { writable } from 'svelte/store';
import { words, shuffleArray } from '$lib/data/words.js';

// Shared constants
export const LETTER_SIZE = 70;
const LETTER_PADDING = 20;

// Letter colors - bright and kid-friendly
const COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // blue
  '#96CEB4', // green
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
  '#BB8FCE', // purple
  '#85C1E9', // light blue
];

function createGameStore() {
  const shuffledWords = shuffleArray(words);
  let wordIndex = 0;

  const store = writable({
    currentWord: '',
    letters: [], // { id, char, color, x, y, placed, slotIndex }
    slots: [],   // { x, y, width, height, filled, letterId }
    phase: 'loading', // 'loading', 'showing', 'scrambling', 'playing', 'celebrating'
    wordsCompleted: 0
  });

  function generateScatterPositions(count, containerWidth, containerHeight, wordZoneTop, wordZoneBottom) {
    const positions = [];

    // Define zones above and below the word area
    const topZone = {
      yMin: LETTER_PADDING,
      yMax: Math.max(LETTER_PADDING, wordZoneTop - LETTER_SIZE - LETTER_PADDING)
    };
    const bottomZone = {
      yMin: wordZoneBottom + LETTER_PADDING,
      yMax: Math.max(wordZoneBottom + LETTER_PADDING, containerHeight - LETTER_SIZE - LETTER_PADDING)
    };

    // Ensure zones have valid ranges (handle small screens)
    const topHeight = topZone.yMax - topZone.yMin;
    const bottomHeight = bottomZone.yMax - bottomZone.yMin;
    const useTopZone = topHeight > LETTER_SIZE;
    const useBottomZone = bottomHeight > LETTER_SIZE;

    // Calculate valid x range
    const xMin = LETTER_PADDING;
    const xMax = Math.max(LETTER_PADDING, containerWidth - LETTER_SIZE - LETTER_PADDING);
    const xRange = xMax - xMin;

    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0;

      // Choose zone: alternate if both valid, otherwise use whichever works
      let zone;
      if (useTopZone && useBottomZone) {
        zone = i % 2 === 0 ? topZone : bottomZone;
      } else if (useTopZone) {
        zone = topZone;
      } else if (useBottomZone) {
        zone = bottomZone;
      } else {
        // Fallback: place around edges if screen is very small
        zone = { yMin: LETTER_PADDING, yMax: containerHeight - LETTER_SIZE - LETTER_PADDING };
      }

      do {
        x = xMin + Math.random() * xRange;
        y = zone.yMin + Math.random() * Math.max(0, zone.yMax - zone.yMin);
        attempts++;
      } while (
        attempts < 50 &&
        positions.some(p => Math.abs(p.x - x) < LETTER_SIZE && Math.abs(p.y - y) < LETTER_SIZE)
      );

      positions.push({ x, y });
    }

    return positions;
  }

  return {
    subscribe: store.subscribe,

    setPhase(phase) {
      store.update(s => ({
        ...s,
        phase
      }));
    },

    initWord(word, containerWidth, containerHeight) {
      const wordZoneTop = containerHeight * 0.35;
      const wordZoneBottom = containerHeight * 0.55;

      // Create slots for the word (positions will be set by WordSlots component)
      const slots = word.split('').map((char, i) => ({
        index: i,
        char,
        filled: false,
        letterId: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }));

      // Create letters with scattered positions and colors
      const scatterPositions = generateScatterPositions(
        word.length,
        containerWidth,
        containerHeight,
        wordZoneTop,
        wordZoneBottom
      );

      const shuffledIndices = shuffleArray([...Array(word.length).keys()]);

      const letters = word.split('').map((char, i) => ({
        id: `letter-${i}`,
        char,
        correctSlotIndex: i,
        color: COLORS[i % COLORS.length],
        x: containerWidth / 2, // Start in center
        y: containerHeight / 2,
        targetX: scatterPositions[shuffledIndices[i]].x,
        targetY: scatterPositions[shuffledIndices[i]].y,
        placed: false,
        slotIndex: null
      }));

      store.update(s => ({
        ...s,
        currentWord: word,
        letters,
        slots,
        phase: 'showing'
      }));
    },

    setSlotPositions(slotPositions) {
      store.update(s => ({
        ...s,
        slots: s.slots.map((slot, i) => ({
          ...slot,
          ...slotPositions[i]
        }))
      }));
    },

    scatterLetters() {
      store.update(s => ({
        ...s,
        letters: s.letters.map(letter => ({
          ...letter,
          x: letter.targetX,
          y: letter.targetY
        })),
        phase: 'playing'
      }));
    },

    updateLetterPosition(letterId, x, y) {
      store.update(s => ({
        ...s,
        letters: s.letters.map(letter =>
          letter.id === letterId ? { ...letter, x, y } : letter
        )
      }));
    },

    placeLetter(letterId, slotIndex) {
      store.update(s => {
        const letter = s.letters.find(l => l.id === letterId);
        const slot = s.slots[slotIndex];

        if (!letter || !slot || slot.filled) return s;

        // Check if letter matches the slot's character (case-insensitive)
        if (letter.char.toLowerCase() !== slot.char.toLowerCase()) {
          // Wrong letter for this slot - move letter just below the word zone
          return {
            ...s,
            letters: s.letters.map(l =>
              l.id === letterId
                ? { ...l, x: l.x, y: slot.y + slot.height + 20 }
                : l
            )
          };
        }

        // Correct letter - place it
        const newSlots = s.slots.map((sl, i) =>
          i === slotIndex ? { ...sl, filled: true, letterId } : sl
        );

        const newLetters = s.letters.map(l =>
          l.id === letterId
            ? { ...l, placed: true, slotIndex, x: slot.x, y: slot.y }
            : l
        );

        // Check if all letters are placed
        const allPlaced = newLetters.every(l => l.placed);

        return {
          ...s,
          letters: newLetters,
          slots: newSlots,
          phase: allPlaced ? 'celebrating' : 'playing'
        };
      });
    },

    nextWord() {
      wordIndex = (wordIndex + 1) % shuffledWords.length;

      // Reshuffle when we've gone through all words
      if (wordIndex === 0) {
        shuffledWords.length = 0;
        shuffledWords.push(...shuffleArray(words));
      }

      store.update(s => ({
        ...s,
        currentWord: shuffledWords[wordIndex],
        wordsCompleted: s.wordsCompleted + 1,
        phase: 'loading'
      }));

      return shuffledWords[wordIndex];
    },

    getNextWord() {
      return shuffledWords[wordIndex];
    }
  };
}

export const game = createGameStore();
