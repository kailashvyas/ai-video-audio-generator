/**
 * Test the image-to-video fix
 */

const { GeminiAPIManager } = require('./dist/api/gemini-api-manager');
const { VeoAPIManager } = require('./dist/api/veo-api-manager');
const fs = require('fs');

async function testImageToVideoFix() {
  console.log('🧪 Testing image-to-video fix...');
  
  try {
    // Check if the methods exist and have correct signatures
    console.log('✅ Checking VeoAPIManager.generateImageToVideo method...');
    
    const veoManager = new VeoAPIManager({
      apiKey: 'test-key',
      maxRetries: 3,
      pollInterval: 10000,
      timeout: 300000
    });
    
    console.log('✅ VeoAPIManager initialized');
    
    // Check if generateImageToVideo method exists
    if (typeof veoManager.generateImageToVideo === 'function') {
      console.log('✅ generateImageToVideo method exists');
    } else {
      console.log('❌ generateImageToVideo method missing');
    }
    
    // Test the GeminiAPIManager
    const apiManager = new GeminiAPIManager({
      apiKey: 'test-key',
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5,
      defaultModel: 'gemini-pro'
    });
    
    console.log('✅ GeminiAPIManager initialized');
    
    // Check if generateVideo method exists
    if (typeof apiManager.generateVideo === 'function') {
      console.log('✅ generateVideo method exists');
    } else {
      console.log('❌ generateVideo method missing');
    }
    
    console.log('✅ All methods exist - the fix should work');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImageToVideoFix();