import { test, expect } from '@playwright/test';

test.describe('Speech synthesis', () => {
  test('should call speechSynthesis.speak when word loads', async ({ page }) => {
    // Track all speech calls
    const speechCalls = [];

    await page.addInitScript(() => {
      // Store original
      const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);

      // Override speak to track calls
      window.speechSynthesis.speak = (utterance) => {
        window.__speechCalls = window.__speechCalls || [];
        window.__speechCalls.push({
          text: utterance.text,
          rate: utterance.rate,
          pitch: utterance.pitch,
          timestamp: Date.now()
        });
        console.log('SPEECH:', utterance.text);
        return originalSpeak(utterance);
      };
    });

    // Listen for console logs
    page.on('console', msg => {
      if (msg.text().startsWith('SPEECH:')) {
        console.log('  → ' + msg.text());
      }
    });

    await page.goto('http://localhost:5180');

    // Wait for game to load and word to be spoken
    await page.waitForTimeout(2000);

    // Get speech calls from page
    const calls = await page.evaluate(() => window.__speechCalls || []);

    console.log('\n=== Speech API Calls ===');
    console.log(JSON.stringify(calls, null, 2));
    console.log('========================\n');

    // Verify word was spoken
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].text).toBeTruthy();
  });

  test('should speak letter when touched', async ({ page }) => {
    const speechCalls = [];

    await page.addInitScript(() => {
      window.__speechCalls = [];
      const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (utterance) => {
        window.__speechCalls.push({
          text: utterance.text,
          timestamp: Date.now()
        });
        console.log('SPEECH:', utterance.text);
        return originalSpeak(utterance);
      };
    });

    page.on('console', msg => {
      if (msg.text().startsWith('SPEECH:')) {
        console.log('  → ' + msg.text());
      }
    });

    await page.goto('http://localhost:5180');

    // Wait for letters to scatter
    await page.waitForTimeout(2500);

    // Get initial call count
    const initialCalls = await page.evaluate(() => window.__speechCalls.length);
    console.log(`Initial speech calls: ${initialCalls}`);

    // Find and click a letter
    const letter = page.locator('.letter').first();
    await letter.click();

    await page.waitForTimeout(500);

    // Check if new speech call was made
    const finalCalls = await page.evaluate(() => window.__speechCalls);
    console.log('\n=== All Speech Calls ===');
    finalCalls.forEach((call, i) => {
      console.log(`${i + 1}. "${call.text}"`);
    });
    console.log('========================\n');

    expect(finalCalls.length).toBeGreaterThan(initialCalls);
  });
});
