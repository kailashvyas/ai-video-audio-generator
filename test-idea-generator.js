/**
 * Test IdeaGenerator directly
 */

import { IdeaGenerator } from './src/services/idea-generator';
import { GeminiAPIManager } from './src/api/gemini-api-manager';
import { getValidatedConfig } from './src/config/index';

async function testIdeaGenerator() {
  try {
    console.log('🧪 Testing IdeaGenerator...\n');
    
    // Get environment config
    const envConfig = getValidatedConfig();
    
    // Create API manager
    const apiManager = new GeminiAPIManager({
      apiKey: envConfig.geminiApiKey,
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 3,
      defaultModel: 'gemini-1.5-flash'
    });
    console.log('✅ API Manager created');
    
    // Create idea generator
    const ideaGenerator = new IdeaGenerator(apiManager);
    console.log('✅ IdeaGenerator created');
    
    // Test idea generation
    console.log('🚀 Generating idea...');
    const idea = await ideaGenerator.generateIdea('A cat dancing with a hat', {
      contentType: 'entertainment',
      targetAudience: 'general',
      duration: 'medium',
      creativity: 'medium'
    });
    
    console.log('✅ Idea generated successfully!');
    console.log(`   Title: ${idea.title}`);
    console.log(`   Description: ${idea.description}`);
    console.log(`   Theme: ${idea.theme}`);
    console.log(`   Duration: ${idea.estimatedDuration}s`);
    console.log(`   Key Points: ${idea.keyPoints.join(', ')}`);
    
  } catch (error) {
    console.error('❌ IdeaGenerator test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testIdeaGenerator();