import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();
  
  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('🔍 Navigating to evaluate page...');
    await page.goto('http://localhost:5173/evaluate', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log(`\n✅ Found ${count} textareas`);
    
    if (count > 0) {
      const firstTextarea = textareas.first();
      console.log('🔍 Filling textarea...');
      await firstTextarea.fill('come possiamo migliorare');
      await page.waitForTimeout(500);
      
      const translateButtons = page.locator('button[title="Traduci in inglese"]');
      const btnCount = await translateButtons.count();
      console.log(`\n✅ Found ${btnCount} translate buttons`);
      
      if (btnCount > 0) {
        const button = translateButtons.first();
        
        // Check DOM state before click
        const isDisabledBefore = await button.getAttribute('disabled');
        console.log(`Button disabled before: ${isDisabledBefore}`);
        
        console.log('\n🔍 Clicking translate button...');
        await button.click();
        console.log('✅ Click sent');
        
        // Wait and check for modal multiple times
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(500);
          
          const lingualabel = page.locator('label:has-text("Lingua")');
          const visible = await lingualabel.isVisible().catch(() => false);
          
          if (visible) {
            console.log(`\n✅ Modal appeared after ${(i + 1) * 500}ms`);
            break;
          } else {
            console.log(`Attempt ${i + 1}: Modal not yet visible...`);
          }
        }
        
        // Final check
        const lingualabel = page.locator('label:has-text("Lingua")');
        const finalVisible = await lingualabel.isVisible().catch(() => false);
        console.log(`\nFinal modal visible: ${finalVisible}`);
        
        if (!finalVisible) {
          // Try to find any visible elements that changed
          const buttons = await page.locator('button').count();
          const divs = await page.locator('div').count();
          console.log(`\nPage still has ${buttons} buttons and ${divs} divs`);
          
          // Take screenshot
          await page.screenshot({ path: 'debug-screenshot.png' });
          console.log('📸 Screenshot saved');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n--- Console Logs Summary ---');
    consoleLogs.forEach(log => {
      if (log.type === 'error' || log.type === 'warning') {
        console.log(`[${log.type}] ${log.text}`);
      }
    });
    await browser.close();
  }
})();
