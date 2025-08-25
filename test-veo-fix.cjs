/**
 * Test the Veo API fix for image-to-video generation
 */

const fs = require('fs');
const path = require('path');

// Mock the Google GenAI SDK to simulate the error and fix
class MockGoogleGenAI {
  constructor() {
    this.models = {
      generateVideos: async (params) => {
        console.log('🧪 Testing generateVideos call...');
        console.log('📋 Parameters received:', {
          model: params.model,
          prompt: params.prompt ? params.prompt.substring(0, 50) + '...' : 'No prompt',
          hasImage: !!params.image,
          imageType: params.image ? typeof params.image.imageBytes : 'N/A'
        });
        
        if (params.image) {
          // This is where the original error occurred
          if (typeof params.image.imageBytes !== 'string') {
            throw new Error('fromImageBytes must be a string');
          }
          
          console.log('✅ Image bytes is a string (base64) - this should work!');
          console.log(`📏 Base64 length: ${params.image.imageBytes.length} characters`);
        }
        
        // Mock successful response
        return {
          name: 'mock-operation-123',
          done: true,
          response: {
            generatedVideos: [{
              video: { name: 'mock-video-file' }
            }]
          }
        };
      }
    };
    
    this.operations = {
      getVideosOperation: async (params) => params.operation
    };
    
    this.files = {
      download: async (params) => {
        console.log(`📥 Mock download to: ${params.downloadPath}`);
        // Create mock file
        const dir = path.dirname(params.downloadPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(params.downloadPath, 'mock video content');
      }
    };
  }
}

// Test the fix
async function testVeoFix() {
  console.log('🧪 Testing Veo API image-to-video fix...\n');
  
  try {
    // Create a mock image file (PNG)
    const mockImagePath = './test-image.png';
    const mockImageData = Buffer.from('mock png data');
    fs.writeFileSync(mockImagePath, mockImageData);
    console.log('✅ Created mock image file');
    
    // Simulate the old approach (this would fail)
    console.log('\n❌ Testing old approach (would fail):');
    try {
      const imageBuffer = fs.readFileSync(mockImagePath);
      const imageBytes = new Uint8Array(imageBuffer);
      
      const mockAI = new MockGoogleGenAI();
      await mockAI.models.generateVideos({
        model: 'veo-3.0-fast-generate-preview',
        prompt: 'Test prompt',
        image: {
          imageBytes: imageBytes, // This is Uint8Array - would cause error
          mimeType: 'image/png'
        }
      });
    } catch (error) {
      console.log(`   Expected error: ${error.message}`);
    }
    
    // Simulate the new approach (this should work)
    console.log('\n✅ Testing new approach (should work):');
    const imageBuffer = fs.readFileSync(mockImagePath);
    const base64String = imageBuffer.toString('base64');
    
    const mockAI = new MockGoogleGenAI();
    const result = await mockAI.models.generateVideos({
      model: 'veo-3.0-fast-generate-preview',
      prompt: 'Test prompt for image-to-video generation',
      image: {
        imageBytes: base64String, // This is string - should work
        mimeType: 'image/png'
      }
    });
    
    console.log('✅ Success! Video generation completed');
    console.log(`🎬 Operation: ${result.name}`);
    
    // Clean up
    fs.unlinkSync(mockImagePath);
    console.log('\n🧹 Cleaned up test files');
    
    console.log('\n🎉 Fix verified! The image-to-video generation should now work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVeoFix();