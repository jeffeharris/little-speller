import { writable } from 'svelte/store';
import { words, shuffleArray } from '$lib/data/words.js';

const MIN_LETTER_SIZE = 64;
const MAX_LETTER_SIZE = 110;
const SLOT_PADDING_FACTOR = 0.28;
const SLOT_GAP_FACTOR = 0.12;

// Letter colors - curated, contrasting 6-color sets
const COLOR_SETS = [
  ['#E74C3C', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#E67E22'],
  ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD', '#F4A261'],
  ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#8338EC', '#F77F00']
];

function createGameStore() {
  const shuffledWords = shuffleArray(words);
  let wordIndex = 0;
  let paletteIndex = 0;
  let colorBag = [];

  const store = writable({
    currentWord: '',
    letters: [], // { id, char, color, x, y, placed, slotIndex }
    slots: [],   // { x, y, width, height, filled, letterId }
    phase: 'loading', // 'loading', 'showing', 'scrambling', 'playing', 'celebrating'
    wordsCompleted: 0,
    placementOrder: [],
    letterSize: 70
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function clampPosition(position, bounds) {
    if (!bounds) return position;
    return {
      x: clamp(position.x, bounds.minX, bounds.maxX),
      y: clamp(position.y, bounds.minY, bounds.maxY)
    };
  }

  function normalizeVelocity(velocity, maxSpeed) {
    if (!velocity) return { x: 0, y: 0 };
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed <= maxSpeed || speed === 0) return velocity;
    const scale = maxSpeed / speed;
    return { x: velocity.x * scale, y: velocity.y * scale };
  }

  function computeLetterSize(containerWidth, containerHeight, wordLength, isLandscape) {
    const widthBudget = containerWidth * 0.88;
    const widthDenominator = wordLength + 2 * SLOT_PADDING_FACTOR + SLOT_GAP_FACTOR * (wordLength - 1);
    const sizeByWidth = widthBudget / widthDenominator;
    const sizeByHeight = containerHeight * (isLandscape ? 0.22 : 0.18);
    const rawSize = Math.min(sizeByWidth, sizeByHeight);

    return clamp(Math.floor(rawSize), MIN_LETTER_SIZE, MAX_LETTER_SIZE);
  }

  function generateScatterPositions(
    count,
    containerWidth,
    containerHeight,
    wordZoneTop,
    wordZoneBottom,
    letterSize
  ) {
    const letterPadding = clamp(Math.round(letterSize * SLOT_PADDING_FACTOR), 16, 32);
    const positions = [];

    // Define zones above and below the word area
    const topZone = {
      yMin: letterPadding,
      yMax: Math.max(letterPadding, wordZoneTop - letterSize - letterPadding)
    };
    const bottomZone = {
      yMin: wordZoneBottom + letterPadding,
      yMax: Math.max(wordZoneBottom + letterPadding, containerHeight - letterSize - letterPadding)
    };

    // Ensure zones have valid ranges (handle small screens)
    const topHeight = topZone.yMax - topZone.yMin;
    const bottomHeight = bottomZone.yMax - bottomZone.yMin;
    const useTopZone = topHeight > letterSize;
    const useBottomZone = bottomHeight > letterSize;

    // Calculate valid x range
    const xMin = letterPadding;
    const xMax = Math.max(letterPadding, containerWidth - letterSize - letterPadding);
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
        zone = { yMin: letterPadding, yMax: containerHeight - letterSize - letterPadding };
      }

      do {
        x = xMin + Math.random() * xRange;
        y = zone.yMin + Math.random() * Math.max(0, zone.yMax - zone.yMin);
        attempts++;
      } while (
        attempts < 50 &&
        positions.some(p => Math.abs(p.x - x) < letterSize && Math.abs(p.y - y) < letterSize)
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

    initWord(word, containerWidth, containerHeight, { isLandscape = false } = {}) {
      const wordZoneTop = containerHeight * (isLandscape ? 0.28 : 0.35);
      const wordZoneBottom = containerHeight * (isLandscape ? 0.46 : 0.55);
      const letterSize = computeLetterSize(containerWidth, containerHeight, word.length, isLandscape);

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
        wordZoneBottom,
        letterSize
      );

      const shuffledIndices = shuffleArray([...Array(word.length).keys()]);

      const letters = word.split('').map((char, i) => ({
        id: `letter-${i}`,
        char,
        correctSlotIndex: i,
        color: takeColorFromBag(),
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
        phase: 'showing',
        placementOrder: [],
        letterSize
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

    showWordInSlots() {
      store.update(s => {
        if (!s.slots.length) return s;
        return {
          ...s,
          letters: s.letters.map(letter => {
            const slot = s.slots[letter.correctSlotIndex];
            if (!slot) return letter;
            return {
              ...letter,
              x: slot.x,
              y: slot.y
            };
          })
        };
      });
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

    getMomentumTarget(position, velocity, bounds) {
      const maxSpeed = 1.6;
      const glideMs = 170;
      const momentum = normalizeVelocity(velocity, maxSpeed);
      const target = {
        x: position.x + momentum.x * glideMs,
        y: position.y + momentum.y * glideMs
      };

      return clampPosition(target, bounds);
    },

    applyMomentum(letterId, position, velocity, bounds) {
      const target = this.getMomentumTarget(position, velocity, bounds);
      store.update(s => ({
        ...s,
        letters: s.letters.map(letter =>
          letter.id === letterId ? { ...letter, x: target.x, y: target.y } : letter
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
        const newPlacementOrder = s.placementOrder.includes(letterId)
          ? s.placementOrder
          : [...s.placementOrder, letterId];

        // Check if all letters are placed
        const allPlaced = newLetters.every(l => l.placed);

        return {
          ...s,
          letters: newLetters,
          slots: newSlots,
          placementOrder: newPlacementOrder,
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

  function refillColorBag() {
    const palette = COLOR_SETS[paletteIndex % COLOR_SETS.length];
    paletteIndex += 1;
    colorBag = shuffleArray(palette);
  }

  function takeColorFromBag() {
    if (colorBag.length === 0) {
      refillColorBag();
    }
    return colorBag.pop();
  }
}

export const game = createGameStore();
