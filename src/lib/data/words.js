// Word list for ages 2-6, organized by length
// Starting with shorter words for younger kids

export const words = [
  // 2-3 letter words (easiest)
  'cat',
  'dog',
  'sun',
  'mom',
  'dad',
  'hat',
  'bat',
  'rat',
  'cup',
  'bug',
  'hug',
  'run',
  'fun',
  'red',
  'bed',
  'pig',
  'big',
  'dig',
  'sit',
  'hit',

  // 4 letter words
  'ball',
  'fish',
  'bird',
  'frog',
  'duck',
  'cake',
  'book',
  'tree',
  'star',
  'moon',
  'bear',
  'lion',
  'jump',
  'play',
  'love',
  'home',
  'door',
  'hand',
  'foot',
  'eyes',

  // 5 letter words (for older kids)
  'apple',
  'happy',
  'house',
  'water',
  'green',
  'blue',
  'smile',
  'train',
  'truck',
  'horse'
];

// Shuffle array using Fisher-Yates
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
