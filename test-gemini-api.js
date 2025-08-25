/**
 * Test Gemini API directly
 */

import { GeminiAPIManager } from './src/api/gemini-api-manager';
import { getValidatedConfig } from './src/config/index';

async function testGeminiAPI() {
  try {
    console.log('🧪 Testing Gemini API directly...\n');
    
    // Get environment config
    const envConfig = getValidatedConfig();
    console.log('✅ Environment config loaded');
    console.log(`   API Key: ${envConfig.geminiApiKey ? 'Set' : 'Missing'}`);
    
    // Create API manager
    const apiManager = new GeminiAPIManager({
      apiKey: envConfig.geminiApiKey,
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 3,
      defaultModel: 'gemini-1.5-flash'
    });
    console.log('✅ API Manager created');
    
    // Test simple text generation
    console.log('🚀 Testing text generation...');
    const prompt = 'Generate a simple creative idea for a short video about cats. Respond with just one sentence.';
    
    const response = await apiManager.generateText(prompt, 'gemini-1.5-flash');
    console.log('✅ API call successful!');
    console.log(`   Response: ${response}`);
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testGeminiAPI();