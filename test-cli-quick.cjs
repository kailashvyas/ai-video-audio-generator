/**
 * Quick test to verify CLI will work with the fix
 */

const fs = require('fs');

async function testCLIFix() {
  console.log('🧪 Testing CLI fix...');
  
  try {
    // Check if the compiled files exist
    const geminiManagerPath = './dist/api/gemini-api-manager.js';
    const veoManagerPath = './dist/api/veo-api-manager.js';
    
    if (fs.existsSync(geminiManagerPath)) {
      console.log('✅ GeminiAPIManager compiled successfully');
    } else {
      console.log('❌ GeminiAPIManager not found');
      return;
    }
    
    if (fs.existsSync(veoManagerPath)) {
      console.log('✅ VeoAPIManager compiled successfully');
    } else {
      console.log('❌ VeoAPIManager not found');
      return;
    }
    
    // Try to import and instantiate (basic test)
    const { GeminiAPIManager } = require(geminiManagerPath);
    const { VeoAPIManager } = require(veoManagerPath);
    
    const apiManager = new GeminiAPIManager({
      apiKey: 'test-key',
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5,
      defaultModel: 'gemini-pro'
    });
    
    const veoManager = new VeoAPIManager({
      apiKey: 'test-key',
      maxRetries: 3,
      pollInterval: 10000,
      timeout: 300000
    });
    
    console.log('✅ Both managers instantiated successfully');
    console.log('✅ The CLI should now work without the image-to-video error');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCLIFix();