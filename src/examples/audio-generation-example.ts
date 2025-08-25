/**
 * Example demonstrating audio generation and synchronization services
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { AudioGenerator } from '../services/audio-generator';
import { MusicGenerator } from '../services/music-generator';
import { AudioSynchronizer } from '../services/audio-synchronizer';
import { ScriptScene, Scene } from '../types/content';

async function runAudioGenerationExample() {
  console.log('🎵 Audio Generation and Synchronization Example');
  console.log('===============================================\n');

  // Initialize services
  const apiManager = new GeminiAPIManager({
    apiKey: process.env.GEMINI_API_KEY || 'demo-key',
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 5,
    defaultModel: 'gemini-pro'
  });

  const audioGenerator = new AudioGenerator(apiManager);
  const musicGenerator = new MusicGenerator(apiManager);
  const audioSynchronizer = new AudioSynchronizer();

  // Sample script scenes
  const scriptScenes: ScriptScene[] = [
    {
      id: 'scene-1',
      description: 'Opening scene in a peaceful forest',
      dialogue: [
        'Welcome to the enchanted forest.',
        'Here, ancient trees whisper secrets of the past.'
      ],
      characters: ['Narrator'],
      visualCues: ['Sunlight filtering through trees', 'Gentle breeze'],
      duration: 8.0
    },
    {
      id: 'scene-2',
      description: 'Exciting discovery of a hidden cave',
      dialogue: [
        'Suddenly, a hidden entrance appears!',
        'What mysteries lie within this ancient cave?'
      ],
      characters: ['Explorer'],
      visualCues: ['Cave entrance', 'Mysterious glow'],
      duration: 6.0
    }
  ];

  // Corresponding video scenes
  const scenes: Scene[] = [
    {
      id: 'video-scene-1',
      scriptSceneId: 'scene-1',
      videoPrompt: 'Peaceful forest with sunlight',
      status: 'completed'
    },
    {
      id: 'video-scene-2',
      scriptSceneId: 'scene-2',
      videoPrompt: 'Hidden cave entrance discovery',
      status: 'completed'
    }
  ];

  try {
    // Step 1: Generate narration for each scene
    console.log('🎙️  Generating narration audio...');
    const narrationResults = await audioGenerator.generateMultipleNarrations(scriptScenes, {
      voice: 'en-US-Standard-A',
      speed: 1.0,
      volume: 0.8
    });

    console.log(`✅ Generated ${narrationResults.length} narration tracks:`);
    narrationResults.forEach((result, index) => {
      console.log(`   Scene ${index + 1}: ${result.audioResult.duration}s (${result.adjustmentsMade ? 'adjusted' : 'original'})`);
    });

    // Step 2: Generate background music
    console.log('\n🎼 Generating background music...');
    const musicScenes = scriptScenes.map(scene => ({
      id: scene.id,
      description: scene.description,
      duration: scene.duration,
      mood: scene.description.includes('peaceful') ? 'peaceful' : 'mysterious'
    }));

    const musicResults = await musicGenerator.generateSceneMusic(musicScenes, {
      genre: 'cinematic',
      volume: 0.3
    });

    console.log(`✅ Generated ${musicResults.length} music tracks:`);
    musicResults.forEach((result, index) => {
      console.log(`   Scene ${index + 1}: ${result.metadata.genre} (${result.metadata.mood}, ${result.metadata.tempo} BPM)`);
    });

    // Step 3: Synchronize and mix audio
    console.log('\n🔄 Synchronizing audio with video scenes...');
    const audioTracks = [
      ...narrationResults.map(r => r.audioTrack),
      ...musicResults.map(r => r.audioTrack)
    ];

    const audioResults = [
      ...narrationResults.map(r => r.audioResult),
      ...musicResults.map(r => r.audioResult)
    ];

    // Use the audio tracks and results for validation
    console.log(`Generated ${audioTracks.length} audio tracks and ${audioResults.length} results`);

    // Validate synchronization requirements
    const validation = audioSynchronizer.validateSynchronization(
      narrationResults.map(r => r.audioTrack),
      scriptScenes
    );

    if (!validation.valid) {
      console.log('❌ Synchronization validation failed:');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
      return;
    }

    // Synchronize narration with scenes
    const syncResult = await audioSynchronizer.synchronizeWithScenes(
      narrationResults.map(r => r.audioTrack),
      narrationResults.map(r => r.audioResult),
      scenes,
      scriptScenes
    );

    console.log('✅ Audio synchronization completed:');
    console.log(`   Total duration: ${syncResult.totalDuration}s`);
    console.log(`   Tracks processed: ${syncResult.synchronizationReport.totalTracks}`);
    console.log(`   Adjustments made: ${syncResult.synchronizationReport.adjustedTracks}`);
    console.log(`   Crossfades applied: ${syncResult.synchronizationReport.crossfades.length}`);

    // Step 4: Generate synchronization report
    console.log('\n📊 Synchronization Report:');
    const reportSummary = audioSynchronizer.generateReportSummary(syncResult.synchronizationReport);
    console.log(reportSummary);

    // Step 5: Mix final audio
    console.log('\n🎛️  Mixing final audio tracks...');
    const mixedAudioUrl = await audioSynchronizer.mixAudioTracks(syncResult.tracks);
    console.log(`✅ Final mixed audio: ${mixedAudioUrl}`);

    // Step 6: Display cost estimates
    console.log('\n💰 Cost Estimates:');
    const totalNarrationCost = narrationResults.length * 0.005; // Estimated cost per narration
    const totalMusicCost = musicResults.reduce((sum, result) => 
      sum + musicGenerator.estimateGenerationCost(result.audioTrack.duration), 0
    );
    
    console.log(`   Narration generation: $${totalNarrationCost.toFixed(3)}`);
    console.log(`   Music generation: $${totalMusicCost.toFixed(3)}`);
    console.log(`   Total estimated cost: $${(totalNarrationCost + totalMusicCost).toFixed(3)}`);

    // Step 7: Display supported options
    console.log('\n🎯 Available Options:');
    console.log('   Supported voices:', audioGenerator.getSupportedVoices().slice(0, 3).join(', '), '...');
    console.log('   Supported music genres:', musicGenerator.getSupportedGenres().slice(0, 5).join(', '), '...');
    console.log('   Supported music moods:', musicGenerator.getSupportedMoods().slice(0, 5).join(', '), '...');

    console.log('\n🎉 Audio generation and synchronization example completed successfully!');

  } catch (error) {
    console.error('❌ Error in audio generation example:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runAudioGenerationExample().catch(console.error);
}

export { runAudioGenerationExample };