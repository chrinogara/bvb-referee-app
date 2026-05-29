import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  try {
    console.log('🔍 Navigating to evaluate page...');
    await page.goto('http://localhost:5173/evaluate', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    console.log('🔍 Looking for observation textarea...');
    const allTextareas = page.locator('textarea');
    const count = await allTextareas.count();
    console.log(`Found ${count} textareas`);
    
    if (count > 0) {
      const firstTextarea = allTextareas.first();
      console.log('🔍 Filling textarea with Italian text...');
      await firstTextarea.fill('come possiamo migliorare la nostra squadra');
      await page.waitForTimeout(800);
      
      console.log('🔍 Looking for translate button near textarea...');
      const translateButtons = page.locator('button[title="Traduci in inglese"]');
      const btnCount = await translateButtons.count();
      console.log(`Found ${btnCount} translate buttons`);
      
      if (btnCount > 0) {
        const button = translateButtons.first();
        const isVisible = await button.isVisible();
        const box = await button.boundingBox();
        console.log(`✅ Translate button visible: ${isVisible}`);
        console.log(`   Button dimensions: ${box?.width.toFixed(1)}x${box?.height.toFixed(1)}px`);
        
        console.log('🔍 Clicking translate button...');
        await button.click();
        console.log('✅ Button clicked');
        
        // Wait for API call and modal to appear
        await page.waitForTimeout(2500);
        
        console.log('🔍 Checking for modal with "Lingua" label...');
        const lingualabel = page.locator('label:has-text("Lingua")');
        const linuaVisible = await lingualabel.isVisible({ timeout: 500 }).catch(() => false);
        console.log(`Lingua label visible: ${linuaVisible}`);
        
        if (linuaVisible) {
          console.log('✅ Modal appeared with language selector!');
          
          // Check language buttons
          const allButtons = page.locator('button');
          const englishBtn = page.locator('button:has-text("English 🇬🇧")');
          const frenchBtn = page.locator('button:has-text("Français 🇫🇷")');
          const dutchBtn = page.locator('button:has-text("Nederlands 🇳🇱")');
          
          const engVisible = await englishBtn.isVisible().catch(() => false);
          const fraVisible = await frenchBtn.isVisible().catch(() => false);
          const dutVisible = await dutchBtn.isVisible().catch(() => false);
          
          console.log(`\n Language buttons visible:`);
          console.log(`   English: ${engVisible}`);
          console.log(`   French: ${fraVisible}`);
          console.log(`   Dutch: ${dutVisible}`);
          
          if (engVisible) {
            const engBox = await englishBtn.boundingBox();
            console.log(`   English button size: ${engBox?.width.toFixed(1)}x${engBox?.height.toFixed(1)}px`);
          }
        } else {
          console.log('❌ Modal did not appear!');
          
          // Take a screenshot to debug
          await page.screenshot({ path: 'test-screenshot.png' });
          console.log('📸 Screenshot saved to test-screenshot.png');
          
          // Log any console errors
          page.on('console', msg => {
            if (msg.type() === 'error') console.log('Console error:', msg.text());
          });
        }
      } else {
        console.log('❌ No translate buttons found');
      }
    } else {
      console.log('❌ No textareas found on evaluate page');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
