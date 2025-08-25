/**
 * Veo 3.0 Integration Test
 * Tests the updated Veo API implementation with real API calls
 */

import { VeoAPIManager } from '../api/veo-api-manager';
import { GeminiAPIManager } from '../api/gemini-api-manager';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testVeo3Integration() {
  console.log('🧪 Starting Veo 3.0 Integration Test...\n');

  // Check for API key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize managers
    const veoManager = new VeoAPIManager({
      apiKey,
      maxRetries: 3,
      pollInterval: 10000,
      timeout: 300000
    });

    const geminiManager = new GeminiAPIManager({
      apiKey,
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5,
      defaultModel: 'gemini-pro'
    });

    console.log('✅ API managers initialized successfully\n');

    // Test 1: Text-to-Video Generation
    console.log('🎬 Test 1: Text-to-Video Generation');
    console.log('=' .repeat(50));
    
    const textPrompt = `A close up of two people staring at a cryptic drawing on a wall, torchlight flickering.
A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'`;

    try {
      const textToVideoResult = await veoManager.generateTextToVideo(textPrompt, {
        duration: 5,
        aspectRatio: '16:9',
        quality: 'standard',
        model: 'veo-3.0-fast-generate-preview', // Cost-optimized
        resolution: '720p' // Cost-optimized
      });

      console.log('✅ Text-to-video generation completed!');
      console.log(`📁 Video saved to: ${textToVideoResult.url}`);
      console.log(`📊 File size: ${(textToVideoResult.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`⏱️ Duration: ${textToVideoResult.duration} seconds\n`);
    } catch (error) {
      console.error('❌ Text-to-video generation failed:', error);
    }

    // Test 2: Image Generation (for image-to-video test)
    console.log('🖼️ Test 2: Image Generation with Imagen 3.0');
    console.log('=' .repeat(50));
    
    const imagePrompt = "Panning wide shot of a calico kitten sleeping in the sunshine";

    try {
      const imageResult = await geminiManager.generateImage(imagePrompt);
      
      console.log('✅ Image generation completed!');
      console.log(`📁 Image saved to: ${imageResult.url}`);
      console.log(`📊 File size: ${(imageResult.size / (1024 * 1024)).toFixed(2)} MB\n`);

      // Test 3: Image-to-Video Generation
      console.log('🎥 Test 3: Image-to-Video Generation');
      console.log('=' .repeat(50));

      // Read the generated image for image-to-video
      const fs = await import('fs/promises');
      const imageBuffer = await fs.readFile(imageResult.url);
      const imageBytes = new Uint8Array(imageBuffer);

      const videoPrompt = "Animate this peaceful scene with gentle movement, the kitten breathing softly and sunlight slowly shifting";

      const imageToVideoResult = await veoManager.generateImageToVideo(
        imageBytes,
        'image/png',
        videoPrompt,
        {
          duration: 5,
          aspectRatio: '16:9',
          quality: 'standard',
          model: 'veo-3.0-fast-generate-preview', // Cost-optimized
          resolution: '720p' // Cost-optimized
        }
      );

      console.log('✅ Image-to-video generation completed!');
      console.log(`📁 Video saved to: ${imageToVideoResult.url}`);
      console.log(`📊 File size: ${(imageToVideoResult.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`⏱️ Duration: ${imageToVideoResult.duration} seconds\n`);

    } catch (error) {
      console.error('❌ Image or image-to-video generation failed:', error);
    }

    // Test 4: Complete Image-to-Video Workflow
    console.log('🔄 Test 4: Complete Image-to-Video Workflow');
    console.log('=' .repeat(50));

    try {
      const workflowImagePrompt = "A serene mountain landscape at sunset with golden light";
      const workflowVideoPrompt = "Slowly pan across the mountain landscape as the sun sets, clouds moving gently";

      const completeWorkflowResult = await veoManager.generateImageToVideoComplete(
        workflowImagePrompt,
        workflowVideoPrompt,
        {
          duration: 5,
          aspectRatio: '16:9',
          quality: 'standard',
          model: 'veo-3.0-fast-generate-preview', // Cost-optimized
          resolution: '720p' // Cost-optimized
        }
      );

      console.log('✅ Complete workflow completed!');
      console.log(`📁 Video saved to: ${completeWorkflowResult.url}`);
      console.log(`📊 File size: ${(completeWorkflowResult.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`⏱️ Duration: ${completeWorkflowResult.duration} seconds\n`);

    } catch (error) {
      console.error('❌ Complete workflow failed:', error);
    }

    // Display usage statistics
    console.log('📊 API Usage Statistics');
    console.log('=' .repeat(50));
    const usageStats = geminiManager.getUsageStats();
    console.log(`💰 Total cost: $${usageStats.totalCost.toFixed(4)}`);
    console.log(`📞 Total requests: ${usageStats.requestCount}`);
    console.log(`🔤 Tokens used: ${usageStats.tokensUsed}`);
    console.log(`📊 Quota remaining: ${usageStats.quotaRemaining}\n`);

    console.log('🎉 Veo 3.0 Integration Test completed successfully!');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVeo3Integration().catch(console.error);
}

export { testVeo3Integration };