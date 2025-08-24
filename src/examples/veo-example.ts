/**
 * Example usage of Veo video generation through Gemini API
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { getValidatedConfig } from '../config';

async function demonstrateVeoGeneration() {
    try {
        // Get configuration
        const envConfig = getValidatedConfig();

        // Initialize API manager
        const apiManager = new GeminiAPIManager({
            apiKey: envConfig.geminiApiKey,
            maxRequestsPerMinute: 60,
            maxConcurrentRequests: 3,
            defaultModel: 'gemini-2.0-flash-exp'
        });

        console.log('🎬 Starting Veo video generation demonstration...\n');

        // Example 1: Text-to-video
        console.log('📝 Example 1: Text-to-video generation');
        const textPrompt = 'A serene mountain landscape with a flowing river, birds flying overhead, and gentle sunlight filtering through the trees. The camera slowly pans across the scene.';

        console.log(`Prompt: "${textPrompt}"`);
        console.log('Generating video...');

        const textVideo = await apiManager.generateVideo(textPrompt);
        console.log(`✅ Generated video: ${textVideo.url}`);
        console.log(`   Duration: ${textVideo.duration}s, Size: ${(textVideo.size / 1024 / 1024).toFixed(2)}MB\n`);

        // Example 2: Image-to-video (with mock reference image)
        console.log('🖼️ Example 2: Image-to-video generation');
        const imagePrompt = 'Animate this character walking forward with a confident stride, hair flowing in the wind';
        const mockReferenceImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'; // Mock base64 image

        console.log(`Prompt: "${imagePrompt}"`);
        console.log('Reference image provided (mock data)');
        console.log('Generating video with reference image...');

        const imageVideo = await apiManager.generateVideo(imagePrompt, mockReferenceImage);
        console.log(`✅ Generated video: ${imageVideo.url}`);
        console.log(`   Duration: ${imageVideo.duration}s, Size: ${(imageVideo.size / 1024 / 1024).toFixed(2)}MB\n`);

        // Show usage statistics
        const stats = apiManager.getUsageStats();
        console.log('📊 Usage Statistics:');
        console.log(`   Total requests: ${stats.requestCount}`);
        console.log(`   Total cost: ${stats.totalCost.toFixed(4)}`);
        console.log(`   Tokens used: ${stats.tokensUsed}`);
        console.log(`   Quota remaining: ${stats.quotaRemaining.toLocaleString()}\n`);

        console.log('🎉 Veo demonstration completed successfully!');

    } catch (error) {
        console.error('❌ Error during Veo demonstration:', error);

        // Handle specific error types with proper type checking
        if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = (error as any).code;
            if (errorCode === 'RATE_LIMIT_EXCEEDED') {
                console.log('💡 Tip: Rate limit exceeded. The system will automatically retry with exponential backoff.');
            } else if (errorCode === 'QUOTA_EXCEEDED') {
                console.log('💡 Tip: API quota exceeded. Check your billing and usage limits.');
            } else {
                console.log('💡 Tip: Check your API key and network connection.');
            }
        } else {
            console.log('💡 Tip: Check your API key and network connection.');
        }
    }
}

// Export for use in other modules
export { demonstrateVeoGeneration };

// Run if this file is executed directly
if (require.main === module) {
  demonstrateVeoGeneration()
    .then(() => console.log('🎉 Veo demonstration completed!'))
    .catch(error => console.error('💥 Veo demonstration failed:', error));
}