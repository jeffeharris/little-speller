import { test, expect } from '@playwright/test';

test('should play pop sound when letter placed correctly', async ({ page }) => {
  // Track audio context calls
  await page.addInitScript(() => {
    window.__audioPlayed = [];

    // Patch AudioContext to track oscillator creation
    const origCreate = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const osc = origCreate.call(this);
      window.__audioPlayed.push({
        type: 'oscillator',
        time: Date.now()
      });
      console.log('AUDIO: Oscillator created');
      return osc;
    };
  });

  page.on('console', msg => {
    if (msg.text().startsWith('AUDIO:')) {
      console.log('  → ' + msg.text());
    }
  });

  await page.goto('http://localhost:5180');

  // Click to start
  await page.click('.loading');
  await page.waitForTimeout(2500);

  // Get audio count before placing letter
  const beforeCount = await page.evaluate(() => window.__audioPlayed?.length || 0);
  console.log('Audio events before drag: ' + beforeCount);

  // Find a letter and drag it to its correct slot
  const letters = await page.locator('.letter').all();
  const slots = await page.locator('.slot').all();

  if (letters.length > 0 && slots.length > 0) {
    const letterBox = await letters[0].boundingBox();
    const slotBox = await slots[0].boundingBox();

    if (letterBox && slotBox) {
      // Drag letter to first slot
      await page.mouse.move(letterBox.x + 35, letterBox.y + 35);
      await page.mouse.down();
      await page.mouse.move(slotBox.x + 35, slotBox.y + 35, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
    }
  }

  const afterCount = await page.evaluate(() => window.__audioPlayed?.length || 0);
  console.log('Audio events after drag: ' + afterCount);
  console.log('New audio events: ' + (afterCount - beforeCount));
});
