/**
 * Simple test to verify real API integration works
 */

import { ContentPipelineOrchestrator } from './src/services/content-pipeline-orchestrator';
import { getValidatedConfig } from './src/config/index';

async function testRealAPI() {
  try {
    console.log('🧪 Testing Real API Integration...\n');
    
    // Get environment config
    const envConfig = getValidatedConfig();
    console.log('✅ Environment config loaded');
    console.log(`   API Key: ${envConfig.geminiApiKey ? 'Set' : 'Missing'}`);
    
    // Create orchestrator
    const orchestrator = new ContentPipelineOrchestrator(envConfig);
    console.log('✅ Orchestrator created');
    
    // Test configuration
    const testConfig = {
      topic: 'A cat dancing with a hat',
      maxScenes: 1,
      budgetLimit: 5.00,
      useImageToVideo: false,
      outputFormats: ['mp4'],
      quality: 'draft'
    };
    
    console.log('🚀 Starting content generation...');
    console.log(`   Topic: ${testConfig.topic}`);
    console.log(`   Scenes: ${testConfig.maxScenes}`);
    console.log(`   Budget: $${testConfig.budgetLimit}`);
    
    // Add progress callback
    const progressCallback = (progress) => {
      const percentage = Math.round(progress.overallProgress * 100);
      console.log(`   Progress: ${progress.currentStage} (${percentage}%)`);
    };
    
    // Generate content
    const result = await orchestrator.generateContent(testConfig, progressCallback);
    
    console.log('\n🎉 Generation completed!');
    console.log(`   Success: ${result.success}`);
    console.log(`   Scenes Generated: ${result.summary.scenesGenerated}`);
    console.log(`   Characters Created: ${result.summary.charactersCreated}`);
    console.log(`   Total Cost: $${result.summary.totalCost.toFixed(2)}`);
    console.log(`   API Calls: ${result.summary.apiCallsUsed}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    if (result.finalOutputPath) {
      console.log(`\n📁 Output: ${result.finalOutputPath}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testRealAPI();