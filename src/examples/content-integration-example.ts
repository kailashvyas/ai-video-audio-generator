/**
 * Content Integration Example
 * 
 * Demonstrates how to use the ContentIntegrator to combine videos, audio, and timing
 * into final multimedia output with multiple format support.
 */

import { ContentIntegrator, type IntegrationConfig } from '../services/content-integrator';
import type { 
  ContentProject, 
  Scene,
  AudioTrack,
  Script,
  ScriptScene,
  ProjectMetadata,
  APIUsageStats,
  GenerationSettings
} from '../types/content';

async function runContentIntegrationExample() {
  console.log('🎬 Content Integration Example');
  console.log('================================\n');

  // Create integration configuration
  const config: IntegrationConfig = {
    outputDirectory: './output/integrated-content',
    outputFormats: ['mp4', 'webm', 'avi'],
    quality: 'high',
    includeMetadata: true,
  };

  // Initialize ContentIntegrator
  const integrator = new ContentIntegrator(config);

  // Create sample project data
  const sampleProject = createSampleProject();

  console.log('📋 Project Overview:');
  console.log(`- Title: ${sampleProject.script.title}`);
  console.log(`- Scenes: ${sampleProject.scenes.length}`);
  console.log(`- Audio Tracks: ${sampleProject.audioTracks.length}`);
  console.log(`- Estimated Duration: ${sampleProject.script.estimatedDuration}s\n`);

  try {
    console.log('🔄 Starting content integration...\n');

    // Integrate all content
    const result = await integrator.integrateContent(sampleProject);

    if (result.success) {
      console.log('✅ Integration completed successfully!\n');

      // Display output files
      console.log('📁 Generated Output Files:');
      result.outputFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file.format.toUpperCase()}`);
        console.log(`   Path: ${file.path}`);
        console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Duration: ${file.duration}s\n`);
      });

      // Display project summary
      console.log('📊 Project Summary:');
      console.log(`- Project ID: ${result.projectSummary.projectId}`);
      console.log(`- Total Duration: ${result.projectSummary.totalDuration}s`);
      console.log(`- Completed Scenes: ${result.projectSummary.sceneCount}`);
      console.log(`- Audio Tracks: ${result.projectSummary.audioTrackCount}`);
      console.log(`- Source Materials: ${result.projectSummary.sourceMaterials.length}`);
      console.log(`- Generated At: ${result.projectSummary.generatedAt.toISOString()}\n`);

      // Display source materials breakdown
      console.log('🎯 Source Materials Breakdown:');
      const materialsByType = result.projectSummary.sourceMaterials.reduce((acc, material) => {
        acc[material.type] = (acc[material.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(materialsByType).forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });

      console.log('\n💰 Cost Information:');
      console.log(`- Total Cost: $${result.projectSummary.metadata.totalCost.toFixed(2)}`);
      console.log(`- API Requests: ${result.projectSummary.metadata.apiUsage.totalRequests}`);

    } else {
      console.log('❌ Integration failed!\n');
      console.log('Errors:');
      result.errors?.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('💥 Integration error:', error);
  }

  // Demonstrate individual operations
  console.log('\n🔧 Individual Operations Demo:');
  await demonstrateIndividualOperations(integrator);
}

function createSampleProject(): ContentProject {
  // Create script scenes
  const scriptScenes: ScriptScene[] = [
    {
      id: 'scene-1',
      description: 'Hero enters the mystical forest',
      dialogue: [
        'The ancient trees whispered secrets of old',
        'Our hero stepped forward with determination'
      ],
      characters: ['hero', 'forest_spirit'],
      visualCues: [
        'Wide shot of towering ancient trees',
        'Dappled sunlight filtering through leaves',
        'Hero in medieval armor walking forward'
      ],
      duration: 25,
    },
    {
      id: 'scene-2',
      description: 'Encounter with the forest guardian',
      dialogue: [
        'Who dares disturb the sacred grove?',
        'I seek the Crystal of Eternal Light'
      ],
      characters: ['hero', 'forest_guardian'],
      visualCues: [
        'Mystical creature emerging from tree trunk',
        'Glowing eyes in the shadows',
        'Hero drawing sword defensively'
      ],
      duration: 30,
    },
    {
      id: 'scene-3',
      description: 'The test of worthiness',
      dialogue: [
        'Prove your heart is pure, young warrior',
        'I accept your challenge, guardian'
      ],
      characters: ['hero', 'forest_guardian'],
      visualCues: [
        'Magical energy swirling around both characters',
        'Hero kneeling in respect',
        'Guardian nodding approvingly'
      ],
      duration: 20,
    },
  ];

  // Create script
  const script: Script = {
    title: 'The Quest for the Crystal of Eternal Light',
    description: 'A brave hero ventures into an ancient forest to find a legendary crystal, facing mystical guardians and tests of character.',
    scenes: scriptScenes,
    estimatedDuration: 75,
  };

  // Create scenes with generated content
  const scenes: Scene[] = [
    {
      id: 'scene-1',
      scriptSceneId: 'scene-1',
      videoPrompt: 'A hero in medieval armor walking through an ancient mystical forest with towering trees and dappled sunlight',
      referenceImage: '/assets/characters/hero_reference.jpg',
      generatedVideo: '/assets/videos/scene_1_forest_entry.mp4',
      status: 'completed',
    },
    {
      id: 'scene-2',
      scriptSceneId: 'scene-2',
      videoPrompt: 'A mystical forest guardian creature emerging from an ancient tree trunk with glowing eyes, facing a medieval hero',
      referenceImage: '/assets/characters/guardian_reference.jpg',
      generatedVideo: '/assets/videos/scene_2_guardian_encounter.mp4',
      status: 'completed',
    },
    {
      id: 'scene-3',
      scriptSceneId: 'scene-3',
      videoPrompt: 'Magical energy swirling around a hero and forest guardian, with the hero kneeling respectfully',
      generatedVideo: '/assets/videos/scene_3_worthiness_test.mp4',
      status: 'completed',
    },
  ];

  // Create audio tracks
  const audioTracks: AudioTrack[] = [
    {
      type: 'narration',
      content: '/assets/audio/narration_full.mp3',
      duration: 75,
      volume: 0.85,
    },
    {
      type: 'music',
      content: '/assets/audio/mystical_forest_theme.mp3',
      duration: 75,
      volume: 0.4,
    },
    {
      type: 'effects',
      content: '/assets/audio/forest_ambience.mp3',
      duration: 75,
      volume: 0.3,
    },
  ];

  // Create metadata
  const apiUsage: APIUsageStats = {
    textGeneration: 8,
    imageGeneration: 4,
    videoGeneration: 3,
    audioGeneration: 3,
    totalRequests: 18,
  };

  const generationSettings: GenerationSettings = {
    maxScenes: 5,
    budgetLimit: 150,
    useImageToVideo: true,
    outputFormats: ['mp4', 'webm'],
    quality: 'high',
  };

  const metadata: ProjectMetadata = {
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T14:30:00Z'),
    totalCost: 87.25,
    apiUsage,
    generationSettings,
  };

  return {
    id: 'crystal-quest-2024-001',
    topic: 'Fantasy Adventure Quest',
    idea: 'A heroic journey through a mystical forest to obtain a legendary crystal, featuring encounters with magical guardians and tests of character.',
    script,
    characters: [
      {
        name: 'hero',
        description: 'A brave warrior in medieval armor with a noble heart and unwavering determination',
        referenceImage: '/assets/characters/hero_reference.jpg',
        appearances: [
          { sceneId: 'scene-1', role: 'protagonist', prominence: 'main' },
          { sceneId: 'scene-2', role: 'protagonist', prominence: 'main' },
          { sceneId: 'scene-3', role: 'protagonist', prominence: 'main' },
        ],
      },
      {
        name: 'forest_guardian',
        description: 'An ancient mystical creature that protects the sacred grove, with glowing eyes and bark-like skin',
        referenceImage: '/assets/characters/guardian_reference.jpg',
        appearances: [
          { sceneId: 'scene-2', role: 'antagonist', prominence: 'main' },
          { sceneId: 'scene-3', role: 'mentor', prominence: 'main' },
        ],
      },
    ],
    scenes,
    audioTracks,
    metadata,
  };
}

async function demonstrateIndividualOperations(integrator: ContentIntegrator) {
  console.log('\n1. Video Concatenation:');
  const videoPaths = [
    '/assets/videos/scene_1_forest_entry.mp4',
    '/assets/videos/scene_2_guardian_encounter.mp4',
    '/assets/videos/scene_3_worthiness_test.mp4',
  ];
  
  try {
    await integrator.concatenateVideos(videoPaths, '/output/concatenated_video.mp4');
    console.log('   ✅ Videos concatenated successfully');
  } catch (error) {
    console.log('   ❌ Concatenation failed:', error);
  }

  console.log('\n2. Audio Overlay:');
  const audioSegments = [
    {
      trackId: 'narration-1',
      audioPath: '/assets/audio/narration_full.mp3',
      startTime: 0,
      duration: 75,
      volume: 0.85,
      type: 'narration' as const,
    },
    {
      trackId: 'music-1',
      audioPath: '/assets/audio/mystical_forest_theme.mp3',
      startTime: 0,
      duration: 75,
      volume: 0.4,
      type: 'music' as const,
    },
  ];

  try {
    await integrator.overlayAudio(
      '/output/concatenated_video.mp4',
      audioSegments,
      '/output/video_with_audio.mp4'
    );
    console.log('   ✅ Audio overlay completed successfully');
  } catch (error) {
    console.log('   ❌ Audio overlay failed:', error);
  }

  console.log('\n3. Format Conversion:');
  const formats = ['webm', 'avi', 'mov'];
  
  for (const format of formats) {
    try {
      await integrator.convertFormat(
        '/output/video_with_audio.mp4',
        `/output/final_video.${format}`,
        format
      );
      console.log(`   ✅ Converted to ${format.toUpperCase()} successfully`);
    } catch (error) {
      console.log(`   ❌ Conversion to ${format.toUpperCase()} failed:`, error);
    }
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runContentIntegrationExample().catch(console.error);
}

export { runContentIntegrationExample };