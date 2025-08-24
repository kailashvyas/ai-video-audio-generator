/**
 * Example demonstrating video generation services usage
 */

import { GeminiAPIManager, GeminiConfig } from '../api/gemini-api-manager';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
import { ImageGenerator } from '../services/image-generator';
import { TextToVideoGenerator, VideoGenerationConfig } from '../services/text-to-video-generator';
import { ImageToVideoGenerator, ImageToVideoConfig } from '../services/image-to-video-generator';
import { ScriptScene } from '../types/content';

async function demonstrateVideoGeneration() {
  console.log('🎬 Video Generation Services Demo');
  console.log('================================\n');

  // Initialize API manager
  const geminiConfig: GeminiConfig = {
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key-here',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-2.0-flash-exp'
  };

  const apiManager = new GeminiAPIManager(geminiConfig);
  const characterManager = new CharacterDatabaseManager();
  const imageGenerator = new ImageGenerator(apiManager);

  // Sample script scenes
  const scriptScenes: ScriptScene[] = [
    {
      id: 'scene-1',
      description: 'A detective walks into a dimly lit office, looking around suspiciously',
      dialogue: ['Something doesn\'t feel right here...'],
      characters: ['Detective Sarah'],
      visualCues: ['medium shot', 'dramatic lighting', 'film noir style'],
      duration: 6
    },
    {
      id: 'scene-2',
      description: 'The detective examines clues on the desk under a desk lamp',
      dialogue: ['These documents... they\'re all connected'],
      characters: ['Detective Sarah'],
      visualCues: ['close-up', 'focused lighting', 'detail shot'],
      duration: 5
    },
    {
      id: 'scene-3',
      description: 'A mysterious figure watches from the shadows outside the window',
      dialogue: [],
      characters: ['Mysterious Figure'],
      visualCues: ['wide shot', 'silhouette', 'suspenseful'],
      duration: 4
    }
  ];

  // Add characters to database
  console.log('📝 Setting up character database...');
  characterManager.addCharacter(
    'Detective Sarah',
    'A sharp-eyed detective in her 40s with shoulder-length brown hair, wearing a dark trench coat and professional attire. She has an intense, focused expression and carries herself with confidence.'
  );
  
  characterManager.addCharacter(
    'Mysterious Figure',
    'A tall, shadowy figure in a dark coat and hat. Face is obscured, creating an air of mystery and danger. Silhouette is imposing and threatening.'
  );

  console.log('✅ Characters added to database\n');

  // Demonstrate Text-to-Video Generation
  console.log('🎥 Text-to-Video Generation Demo');
  console.log('--------------------------------');

  const textToVideoConfig: VideoGenerationConfig = {
    maxScenes: 2, // Limit for cost control
    quality: 'standard',
    aspectRatio: '16:9',
    duration: 5
  };

  const textToVideoGenerator = new TextToVideoGenerator(
    apiManager,
    characterManager,
    textToVideoConfig
  );

  try {
    console.log('Generating videos from script using text-to-video...');
    const textVideoResult = await textToVideoGenerator.generateVideosFromScript(scriptScenes);
    
    console.log(`✅ Text-to-Video Generation Complete!`);
    console.log(`   - Total scenes processed: ${textVideoResult.totalScenes}`);
    console.log(`   - Successfully completed: ${textVideoResult.completed.length}`);
    console.log(`   - Failed: ${textVideoResult.failed.length}`);
    
    textVideoResult.completed.forEach((scene, index) => {
      console.log(`   - Scene ${index + 1}: ${scene.generatedVideo}`);
    });

    if (textVideoResult.failed.length > 0) {
      console.log('   Failed scenes:');
      textVideoResult.failed.forEach((scene, index) => {
        console.log(`   - Scene ${index + 1}: ${scene.id} (${scene.status})`);
      });
    }
  } catch (error) {
    console.error('❌ Text-to-Video generation failed:', error);
  }

  console.log('\n🖼️ Image-to-Video Generation Demo');
  console.log('----------------------------------');

  const imageToVideoConfig: ImageToVideoConfig = {
    maxScenes: 2, // Limit for cost control
    quality: 'standard',
    aspectRatio: '16:9',
    duration: 5,
    generateReferenceImages: true,
    reuseCharacterImages: true
  };

  const imageToVideoGenerator = new ImageToVideoGenerator(
    apiManager,
    characterManager,
    imageGenerator,
    imageToVideoConfig
  );

  try {
    console.log('Generating videos from script using image-to-video...');
    console.log('This will first generate character reference images...');
    
    const imageVideoResult = await imageToVideoGenerator.generateVideosFromScript(scriptScenes);
    
    console.log(`✅ Image-to-Video Generation Complete!`);
    console.log(`   - Total scenes processed: ${imageVideoResult.totalScenes}`);
    console.log(`   - Successfully completed: ${imageVideoResult.completed.length}`);
    console.log(`   - Failed: ${imageVideoResult.failed.length}`);
    console.log(`   - Character images generated: ${imageVideoResult.characterImages.length}`);
    
    imageVideoResult.completed.forEach((scene, index) => {
      console.log(`   - Scene ${index + 1}: ${scene.generatedVideo} (ref: ${scene.referenceImage})`);
    });

    console.log('\n📊 Character Image Cache:');
    const characterCache = imageToVideoGenerator.getCharacterImageCache();
    characterCache.forEach(cache => {
      console.log(`   - ${cache.characterName}: ${cache.imageUrl} (used in ${cache.sceneIds.length} scenes)`);
    });

  } catch (error) {
    console.error('❌ Image-to-Video generation failed:', error);
  }

  // Demonstrate progress tracking
  console.log('\n📈 Progress Tracking Demo');
  console.log('-------------------------');

  const progress = textToVideoGenerator.getProgress();
  console.log(`Current progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);

  const queueStatus = textToVideoGenerator.getQueueStatus();
  console.log(`Queue status: ${queueStatus.scenes.length} scenes, ${queueStatus.completed.length} completed`);

  // Demonstrate scene limit enforcement
  console.log('\n🚦 Scene Limit Enforcement Demo');
  console.log('-------------------------------');

  const largeBatch: ScriptScene[] = Array.from({ length: 10 }, (_, i) => ({
    id: `batch-scene-${i + 1}`,
    description: `Batch scene ${i + 1} description`,
    dialogue: [`Dialogue for scene ${i + 1}`],
    characters: ['Detective Sarah'],
    visualCues: ['standard shot'],
    duration: 5
  }));

  try {
    console.log(`Attempting to generate ${largeBatch.length} scenes with limit of ${textToVideoConfig.maxScenes}...`);
    const limitedResult = await textToVideoGenerator.generateVideosFromScript(largeBatch);
    
    console.log(`✅ Scene limit enforced successfully!`);
    console.log(`   - Requested: ${largeBatch.length} scenes`);
    console.log(`   - Actually processed: ${limitedResult.totalScenes} scenes`);
    console.log(`   - Limit respected: ${limitedResult.totalScenes <= textToVideoConfig.maxScenes}`);
  } catch (error) {
    console.error('❌ Scene limit enforcement failed:', error);
  }

  // Demonstrate character consistency
  console.log('\n👥 Character Consistency Demo');
  console.log('-----------------------------');

  const characterPrompt = characterManager.generateCharacterPrompt(
    ['Detective Sarah', 'Mysterious Figure'],
    'A tense confrontation scene',
    {
      includeAppearances: true,
      maxDescriptionLength: 150,
      prioritizeMainCharacters: true
    }
  );

  console.log('Generated character-consistent prompt:');
  console.log(`"${characterPrompt}"`);

  console.log('\n🎯 API Usage Summary');
  console.log('-------------------');
  const usageStats = apiManager.getUsageStats();
  console.log(`Total API requests: ${usageStats.requestCount}`);
  console.log(`Total cost: $${usageStats.totalCost.toFixed(4)}`);
  console.log(`Tokens used: ${usageStats.tokensUsed}`);
  console.log(`Quota remaining: ${usageStats.quotaRemaining}`);

  console.log('\n✨ Video Generation Demo Complete!');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateVideoGeneration().catch(console.error);
}

export { demonstrateVideoGeneration };