/**
 * Example usage of ImageGenerator service
 */

import { ImageGenerator, ImageGenerationConfig, CharacterImageRequest } from '../services/image-generator';
import { GeminiAPIManager } from '../api/gemini-api-manager';
import { Character } from '../types/content';

async function demonstrateImageGeneration() {
  // Initialize API manager
  const apiManager = new GeminiAPIManager({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-2.0-flash-exp'
  });

  // Initialize image generator
  const imageGenerator = new ImageGenerator(apiManager, './character-images');

  // Define characters
  const characters: Character[] = [
    {
      name: 'Elena Rodriguez',
      description: 'A confident detective in her 30s with short black hair, wearing a dark blue suit and badge',
      appearances: []
    },
    {
      name: 'Marcus Chen',
      description: 'A young tech entrepreneur with glasses, casual hoodie, and friendly demeanor',
      appearances: []
    },
    {
      name: 'Dr. Sarah Williams',
      description: 'A professional scientist in a white lab coat, with blonde hair tied back and safety goggles',
      appearances: []
    }
  ];

  console.log('🎨 Starting character image generation...\n');

  for (const character of characters) {
    try {
      console.log(`Generating image for ${character.name}...`);

      // Configure image generation
      const config: ImageGenerationConfig = {
        style: 'realistic',
        quality: 'high',
        aspectRatio: '1:1',
        resolution: 'medium'
      };

      const request: CharacterImageRequest = {
        character,
        config,
        additionalPrompts: [
          'professional lighting',
          'clear facial features',
          'suitable for character reference',
          'high contrast'
        ]
      };

      // Generate character image
      const result = await imageGenerator.generateCharacterImage(request);

      console.log(`✅ Generated image for ${character.name}`);
      console.log(`   - Image ID: ${result.id}`);
      console.log(`   - Dimensions: ${result.metadata.dimensions.width}x${result.metadata.dimensions.height}`);
      console.log(`   - Quality Score: ${result.metadata.validationResult.quality.toFixed(2)}`);
      console.log(`   - File Size: ${(result.metadata.fileSize / 1024 / 1024).toFixed(2)} MB`);
      
      if (result.metadata.validationResult.suggestions.length > 0) {
        console.log(`   - Suggestions: ${result.metadata.validationResult.suggestions.join(', ')}`);
      }
      
      console.log('');

    } catch (error) {
      console.error(`❌ Failed to generate image for ${character.name}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Demonstrate image retrieval
  console.log('📁 Retrieving stored character images...\n');

  const storedImages = await imageGenerator.listCharacterImages();
  console.log(`Found ${storedImages.length} stored character images:`);

  for (const image of storedImages) {
    console.log(`- ${image.characterName}: ${image.id} (${image.createdAt.toISOString()})`);
  }

  // Demonstrate individual image retrieval
  if (characters.length > 0) {
    const firstCharacter = characters[0];
    const retrievedImage = await imageGenerator.getCharacterImage(firstCharacter.name);
    
    if (retrievedImage) {
      console.log(`\n🔍 Retrieved image for ${firstCharacter.name}:`);
      console.log(`   - Prompt used: ${retrievedImage.metadata.prompt.substring(0, 100)}...`);
      console.log(`   - Validation issues: ${retrievedImage.metadata.validationResult.issues.length}`);
    }
  }

  console.log('\n🎯 Image generation demonstration complete!');
}

async function demonstrateImageStyles() {
  console.log('\n🎨 Demonstrating different image styles...\n');

  const apiManager = new GeminiAPIManager({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-2.0-flash-exp'
  });

  const imageGenerator = new ImageGenerator(apiManager, './style-examples');

  const testCharacter: Character = {
    name: 'Style Test Character',
    description: 'A friendly person with a warm smile and expressive eyes',
    appearances: []
  };

  const styles: Array<{ style: 'realistic' | 'animated' | 'artistic'; description: string }> = [
    { style: 'realistic', description: 'Photorealistic style' },
    { style: 'animated', description: 'Cartoon/animated style' },
    { style: 'artistic', description: 'Artistic interpretation' }
  ];

  for (const { style, description } of styles) {
    try {
      console.log(`Generating ${description}...`);

      const config: ImageGenerationConfig = {
        style,
        quality: 'standard',
        aspectRatio: '1:1',
        resolution: 'medium'
      };

      const request: CharacterImageRequest = {
        character: { ...testCharacter, name: `${testCharacter.name} ${style}` },
        config
      };

      const result = await imageGenerator.generateCharacterImage(request);
      console.log(`✅ Generated ${style} style image (Quality: ${result.metadata.validationResult.quality.toFixed(2)})`);

    } catch (error) {
      console.error(`❌ Failed to generate ${style} style: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function demonstrateImageUpdate() {
  console.log('\n🔄 Demonstrating image update functionality...\n');

  const apiManager = new GeminiAPIManager({
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-2.0-flash-exp'
  });

  const imageGenerator = new ImageGenerator(apiManager, './update-examples');

  const character: Character = {
    name: 'Update Test Character',
    description: 'A character that will be updated with different styles',
    appearances: []
  };

  try {
    // Generate initial image
    console.log('Generating initial image...');
    const initialConfig: ImageGenerationConfig = {
      style: 'realistic',
      quality: 'draft',
      aspectRatio: '1:1',
      resolution: 'low'
    };

    const initialRequest: CharacterImageRequest = {
      character,
      config: initialConfig
    };

    const initialResult = await imageGenerator.generateCharacterImage(initialRequest);
    console.log(`✅ Initial image generated (ID: ${initialResult.id})`);

    // Update with higher quality
    console.log('Updating with higher quality...');
    const updatedConfig: ImageGenerationConfig = {
      style: 'realistic',
      quality: 'high',
      aspectRatio: '1:1',
      resolution: 'high'
    };

    const updateRequest: CharacterImageRequest = {
      character,
      config: updatedConfig,
      additionalPrompts: ['ultra high detail', 'professional photography']
    };

    const updatedResult = await imageGenerator.updateCharacterImage(updateRequest);
    console.log(`✅ Image updated (New ID: ${updatedResult.id})`);
    console.log(`   Quality improved from ${initialResult.metadata.validationResult.quality.toFixed(2)} to ${updatedResult.metadata.validationResult.quality.toFixed(2)}`);

  } catch (error) {
    console.error(`❌ Update demonstration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      await demonstrateImageGeneration();
      await demonstrateImageStyles();
      await demonstrateImageUpdate();
    } catch (error) {
      console.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
}

export {
  demonstrateImageGeneration,
  demonstrateImageStyles,
  demonstrateImageUpdate
};