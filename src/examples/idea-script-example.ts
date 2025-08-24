/**
 * Example demonstrating IdeaGenerator and ScriptGenerator services
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { IdeaGenerator } from '../services/idea-generator';
import { ScriptGenerator } from '../services/script-generator';

async function demonstrateIdeaAndScriptGeneration() {
  // Initialize the Gemini API Manager
  const geminiManager = new GeminiAPIManager({
    apiKey: process.env.GEMINI_API_KEY || 'demo-key',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-pro'
  });

  // Initialize the services
  const ideaGenerator = new IdeaGenerator(geminiManager, {
    creativity: 'high',
    contentType: 'educational',
    targetAudience: 'general',
    duration: 'medium'
  });

  const scriptGenerator = new ScriptGenerator(geminiManager, {
    maxScenes: 5,
    sceneLength: 'medium',
    narrativeStyle: 'storytelling',
    pacing: 'medium'
  });

  try {
    console.log('🎯 Generating content idea...');
    
    // Generate an idea for a specific topic
    const idea = await ideaGenerator.generateIdea('artificial intelligence in daily life');
    
    console.log('✅ Generated idea:');
    console.log(`Title: ${idea.title}`);
    console.log(`Description: ${idea.description}`);
    console.log(`Theme: ${idea.theme}`);
    console.log(`Duration: ${idea.estimatedDuration} seconds`);
    console.log(`Key Points: ${idea.keyPoints.join(', ')}`);
    console.log(`Visual Style: ${idea.visualStyle}`);
    console.log(`Mood: ${idea.mood}`);
    console.log('');

    console.log('📝 Generating script from idea...');
    
    // Generate a script from the idea
    const script = await scriptGenerator.generateScript(idea);
    
    console.log('✅ Generated script:');
    console.log(`Title: ${script.title}`);
    console.log(`Description: ${script.description}`);
    console.log(`Total Duration: ${script.estimatedDuration} seconds`);
    console.log(`Number of Scenes: ${script.scenes.length}`);
    console.log('');

    // Display each scene
    script.scenes.forEach((scene, index) => {
      console.log(`Scene ${index + 1} (${scene.id}):`);
      console.log(`  Duration: ${scene.duration} seconds`);
      console.log(`  Characters: ${scene.characters.join(', ')}`);
      console.log(`  Description: ${scene.description}`);
      console.log(`  Dialogue: ${scene.dialogue.join(' | ')}`);
      console.log(`  Visual Cues: ${scene.visualCues.join(', ')}`);
      console.log('');
    });

    // Extract and display characters
    console.log('👥 Extracting characters...');
    const characters = scriptGenerator.extractCharacters(script);
    
    console.log('✅ Extracted characters:');
    characters.forEach(character => {
      console.log(`${character.name}:`);
      console.log(`  Role: ${character.role}`);
      console.log(`  Description: ${character.description}`);
      console.log(`  Appears in scenes: ${character.appearances.join(', ')}`);
      console.log('');
    });

    // Validate the script
    console.log('🔍 Validating script...');
    const validation = scriptGenerator.validateScript(script);
    
    console.log('✅ Validation results:');
    console.log(`Valid: ${validation.isValid}`);
    if (validation.errors.length > 0) {
      console.log(`Errors: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`Warnings: ${validation.warnings.join(', ')}`);
    }
    if (validation.suggestions.length > 0) {
      console.log(`Suggestions: ${validation.suggestions.join(', ')}`);
    }

    // Generate idea variations
    console.log('🔄 Generating idea variations...');
    const variations = await ideaGenerator.generateIdeaVariations('artificial intelligence', 3);
    
    console.log('✅ Generated variations:');
    variations.forEach((variation, index) => {
      console.log(`Variation ${index + 1}: ${variation.title}`);
      console.log(`  ${variation.description}`);
      console.log('');
    });

    // Generate trending topic
    console.log('📈 Generating trending topic...');
    const trendingTopic = await ideaGenerator.generateTrendingTopic();
    
    console.log(`✅ Trending topic: ${trendingTopic}`);

  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  }
}

// Export for use in other modules
export { demonstrateIdeaAndScriptGeneration };

// Run if this file is executed directly
if (require.main === module) {
  demonstrateIdeaAndScriptGeneration()
    .then(() => console.log('🎉 Demonstration completed!'))
    .catch(error => console.error('💥 Demonstration failed:', error));
}