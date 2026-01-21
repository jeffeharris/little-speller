// Sound effects - using HTML5 Audio for iOS compatibility

let popSound = null;

// Base64 encoded short pop/click sound
const POP_SOUND_DATA = 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAAB/f39/f39/f4KIjpSZnaGkoqCdmJKLhH17eHZ1dnd6f4WMk5qgpqqsq6iknpiRin9zcGtoaGlscXiAiZGZoKaqq6qnopyVjYR7cGdgWVdXWV1jaHB6hI6Xn6Woqainop2Wj4Z9cmdiXFdVU1VYXWRtd4KMlp+lq66vrKmlnpiPhn1yZ2BaVVFQUFNYX2dxe4eQmqKorK6urKmkoZiQhn1xZ19ZVFBOTlBUWmNscHeAjZagqK2wr62qpqGYkYd9c2ljXVlUUE9OUFVcZW51f4qUnKOprq+uraumoZqRiX9zbWZgWlZTUE9RVVtjbHV/i5Sco6qur66sqKSemJCGfXJqY1xYVFFOTlFWXWVud4GNlp6lq6+wr66qpqGZkId+c2xmX1lUUE1MTlNaYmtze4aMlZ2kqq6wr66rp6KbkoqAfHJrZF5ZU09MTU9UW2Nrdn+Jkpqhp6yvsK6sqaOfmZCHfnVuZ2FcV1JOTExPU1pfZ3F7hY6Wnaaqrq+vraylop2Wj4Z+dW5oYV1XU05MTU9TV1xka3R9homRmaCmq66vrq2ppKCZkYmBenNtZ2JdWVRQTU1OUVVaYGhweYKKkpieoqiqq6yqp6Sfm5SPh4B5c21oY19bV1NOTVBSVV1ia3N8hI2UnqOoq62trKqno5+Zk4yEfHZwamViXllVUE5NT1FWWmBncHmBipKZn6Omqaqrq6qnpKCcl5GKgnt0b2pnY19bWFRRT09SVllgZ294gIiPl52jpqmrq6yrqKWhnpqVj4mCe3VwbGlmYl9bWFVTUlNWWV5lbHR8g4uTmZ+jp6mqq6yrqaalop+bmJONh4F8d3NvbGllYl9cWVdWVlhaXWNpb3d/hoySnqGmqKqrrKupp6WjoZ6bmJSQi4aDfnl2c3BtaWdkYF9dXFtcXmFlaW50eoGGjJGWmZ2foKGhoaCfnp2bmJaSj4yKhoOAfXp3dHJwbmxqaGdlZGNjY2RlZ2lrbnF0d3p9gIKFh4mKi4yMjIyLi4qJiIeGhYSDgoGAf359fHt6eXl4eHd3d3d3d3d4eHl6e3x9fn+AgYKDhIWGh4iJiouMjI2Njo6Ojo6Ojo6OjY2MjIuLiomIh4aFhIOCgYB/fn18e3p5eXh3d3Z2dnZ2dnd3eHl6e3x9f4CBgoOEhYaHiImKi4yNjY6Ojo+Pj4+Pj4+Pj46OjY2MjIuKiYmIh4aFhIOCgYB/fn18e3p5eHh3dnZ2dnV1dXV2dnd4eXp7fH1/gIGCg4SFhoeIiYqLjI2Ojo+Pj4+QkJCQkJCPj4+Pjo6NjYyLioqJiIeGhYSDgoGAf359fHt6eXh4d3Z2dXV1dXV1dXZ2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj4+QkJCQkJGRkZGRkJCQj4+OjY2MjIuKiYiHhoWEg4KBgH9+fXx7enl4d3d2dnV1dXR0dHV1dXZ3eHl6e3x+f4CBgoOEhYaHiImKi4yNjo+PkJCRkZGRkZGRkZGQkI+Pjo6NjYyLioqJiIeGhYSDgoGAf359fHt6eXh3d3Z2dXV0dHR0dHV1dnd4eXp7fH5/gIGCg4SFhoeIiYqLjI2Oj4+QkJGRkZGSkpKSkZGRkJCPj46OjY2Mi4qKiYiHhoWEg4KBgH9+fXx7enl4d3d2dnV1dHR0dHR0dXV2d3h5ent8fn+AgYKDhIWGh4iJiouMjY6Pj5CQkZGRkpKSkpKSkZGQkI+Pjo6NjIyLioqJiIeGhYSDgoGAf359fHt6eXh3d3Z2dXV0dHR0dHR1dXZ3eHl6e3x+f4CBgoOEhYaHiImKi4yNjo+PkJCRkZGSkpKSkpKRkZCQj4+OjY2MjIuKiYmIh4aFhIOCgYB/fn18e3p5eHd3dnZ1dXR0dA==';

// Initialize sounds (call after user interaction on iOS)
function initSounds() {
  if (typeof window === 'undefined') return;

  if (!popSound) {
    popSound = new Audio(POP_SOUND_DATA);
    popSound.volume = 1.0;  // Max volume
  }
}

// Resume audio (needed after user interaction on mobile)
export function resumeAudio() {
  initSounds();
  // Play and immediately pause to "unlock" audio on iOS
  if (popSound) {
    const playPromise = popSound.play();
    if (playPromise) {
      playPromise.then(() => {
        popSound.pause();
        popSound.currentTime = 0;
      }).catch(() => {});
    }
  }
}

// Play a satisfying pop sound when letter snaps into place
export function playPop() {
  initSounds();
  if (popSound) {
    popSound.currentTime = 0;
    popSound.play().catch(() => {});
  }
}

// Play a celebratory sound when word is complete (reuse pop for now)
export function playCelebration() {
  // Play pop 3 times quickly for celebration
  initSounds();
  if (popSound) {
    popSound.currentTime = 0;
    popSound.play().catch(() => {});

    setTimeout(() => {
      if (popSound) {
        popSound.currentTime = 0;
        popSound.play().catch(() => {});
      }
    }, 150);

    setTimeout(() => {
      if (popSound) {
        popSound.currentTime = 0;
        popSound.play().catch(() => {});
      }
    }, 300);
  }
}

// Play a soft thud for wrong placement (reuse pop with lower volume)
export function playThud() {
  initSounds();
  if (popSound) {
    const originalVolume = popSound.volume;
    popSound.volume = 0.3;
    popSound.currentTime = 0;
    popSound.play().catch(() => {});
    setTimeout(() => {
      if (popSound) popSound.volume = originalVolume;
    }, 200);
  }
}
