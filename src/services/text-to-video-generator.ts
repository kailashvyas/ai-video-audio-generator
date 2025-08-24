/**
 * Text-to-Video Generator Service
 * Handles script-based video generation using Veo through Gemini API
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
import { VideoResult } from '../types/api';
import { ScriptScene, Scene } from '../types/content';

export interface VideoGenerationConfig {
  maxScenes: number;
  quality: 'draft' | 'standard' | 'high';
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number; // seconds per scene
}

export interface VideoGenerationQueue {
  scenes: Scene[];
  currentIndex: number;
  totalScenes: number;
  completed: Scene[];
  failed: Scene[];
}

export interface VideoPromptEngineering {
  basePrompt: string;
  characterDescriptions: string;
  visualStyle: string;
  technicalSpecs: string;
}

/**
 * Generates videos from script scenes using text-to-video AI
 */
export class TextToVideoGenerator {
  private apiManager: GeminiAPIManager;
  private characterManager: CharacterDatabaseManager;
  private config: VideoGenerationConfig;
  private queue: VideoGenerationQueue;

  constructor(
    apiManager: GeminiAPIManager,
    characterManager: CharacterDatabaseManager,
    config: VideoGenerationConfig
  ) {
    this.apiManager = apiManager;
    this.characterManager = characterManager;
    this.config = config;
    this.queue = this.initializeQueue();
  }

  /**
   * Generate videos for multiple script scenes with scene limit enforcement
   */
  async generateVideosFromScript(
    scriptScenes: ScriptScene[],
    startIndex: number = 0
  ): Promise<VideoGenerationQueue> {
    // Enforce scene limit
    const scenesToProcess = scriptScenes.slice(
      startIndex, 
      startIndex + this.config.maxScenes
    );

    // Convert script scenes to video scenes
    const videoScenes = this.convertScriptScenesToVideoScenes(scenesToProcess);
    
    // Initialize queue
    this.queue = {
      scenes: videoScenes,
      currentIndex: 0,
      totalScenes: videoScenes.length,
      completed: [],
      failed: []
    };

    // Process scenes sequentially to manage API rate limits
    for (let i = 0; i < videoScenes.length; i++) {
      this.queue.currentIndex = i;
      const scene = videoScenes[i];
      
      try {
        scene.status = 'generating';
        const videoResult = await this.generateSingleVideo(scene);
        
        scene.generatedVideo = videoResult.url;
        scene.status = 'completed';
        this.queue.completed.push(scene);
        
      } catch (error) {
        scene.status = 'failed';
        this.queue.failed.push(scene);
        console.error(`Failed to generate video for scene ${scene.id}:`, error);
      }
    }

    return this.queue;
  }

  /**
   * Generate a single video from a scene
   */
  async generateSingleVideo(scene: Scene): Promise<VideoResult> {
    // Engineer the prompt with character descriptions
    const engineeredPrompt = this.engineerVideoPrompt(scene);
    
    // Generate video using Gemini API
    const videoResult = await this.apiManager.generateVideo(
      engineeredPrompt,
      undefined, // No reference image for text-to-video
      'gemini-2.0-flash-exp'
    );

    return videoResult;
  }

  /**
   * Engineer video prompt with character descriptions and visual cues
   */
  private engineerVideoPrompt(scene: Scene): string {
    // Get script scene details
    const scriptScene = this.findScriptScene(scene.scriptSceneId);
    if (!scriptScene) {
      throw new Error(`Script scene not found for scene ${scene.id}`);
    }

    // Build character-consistent prompt
    const characterPrompt = this.characterManager.generateCharacterPrompt(
      scriptScene.characters,
      scene.videoPrompt,
      {
        includeAppearances: true,
        maxDescriptionLength: 150,
        prioritizeMainCharacters: true
      }
    );

    // Add technical specifications
    const technicalSpecs = this.buildTechnicalSpecs();
    
    // Add visual style guidance
    const visualStyle = this.buildVisualStyle(scriptScene);
    
    // Combine all elements
    const fullPrompt = [
      characterPrompt,
      visualStyle,
      `Scene duration: ${this.config.duration} seconds.`,
      `Visual cues: ${scriptScene.visualCues.join(', ')}.`,
      technicalSpecs
    ].join(' ');

    return fullPrompt;
  }

  /**
   * Convert script scenes to video scenes
   */
  private convertScriptScenesToVideoScenes(scriptScenes: ScriptScene[]): Scene[] {
    return scriptScenes.map((scriptScene, index) => ({
      id: `video-scene-${index + 1}`,
      scriptSceneId: scriptScene.id,
      videoPrompt: this.buildBaseVideoPrompt(scriptScene),
      status: 'pending' as const
    }));
  }

  /**
   * Build base video prompt from script scene
   */
  private buildBaseVideoPrompt(scriptScene: ScriptScene): string {
    const elements = [
      `Scene: ${scriptScene.description}`,
      scriptScene.dialogue.length > 0 ? `Dialogue: ${scriptScene.dialogue.join(' ')}` : '',
      scriptScene.characters.length > 0 ? `Characters: ${scriptScene.characters.join(', ')}` : ''
    ].filter(Boolean);

    return elements.join('. ');
  }

  /**
   * Build technical specifications for video generation
   */
  private buildTechnicalSpecs(): string {
    const specs = {
      'draft': 'Low resolution, fast generation',
      'standard': 'Standard HD quality, balanced generation time',
      'high': 'High definition, detailed generation'
    };

    return `Quality: ${specs[this.config.quality]}. Aspect ratio: ${this.config.aspectRatio}.`;
  }

  /**
   * Build visual style guidance based on scene content
   */
  private buildVisualStyle(scriptScene: ScriptScene): string {
    // Analyze scene content to determine appropriate visual style
    const description = scriptScene.description.toLowerCase();
    
    let style = 'Cinematic style with professional lighting.';
    
    if (description.includes('outdoor') || description.includes('nature')) {
      style += ' Natural outdoor lighting, wide establishing shots.';
    } else if (description.includes('indoor') || description.includes('room')) {
      style += ' Indoor lighting setup, medium shots with depth of field.';
    }
    
    if (description.includes('action') || description.includes('fast')) {
      style += ' Dynamic camera movement, quick cuts.';
    } else if (description.includes('conversation') || description.includes('dialogue')) {
      style += ' Steady camera work, shot-reverse-shot for dialogue.';
    }

    return style;
  }

  /**
   * Find script scene by ID (placeholder - would integrate with script storage)
   */
  private findScriptScene(scriptSceneId: string): ScriptScene | null {
    // In a real implementation, this would query the script storage
    // For now, return a placeholder
    return {
      id: scriptSceneId,
      description: 'Scene description placeholder',
      dialogue: [],
      characters: [],
      visualCues: [],
      duration: this.config.duration
    };
  }

  /**
   * Get current generation progress
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    const completed = this.queue.completed.length;
    const total = this.queue.totalScenes;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  /**
   * Get generation queue status
   */
  getQueueStatus(): VideoGenerationQueue {
    return { ...this.queue };
  }

  /**
   * Pause video generation (for future implementation)
   */
  pauseGeneration(): void {
    // Implementation would set a pause flag and stop processing new scenes
    console.log('Video generation paused');
  }

  /**
   * Resume video generation (for future implementation)
   */
  resumeGeneration(): void {
    // Implementation would clear pause flag and continue processing
    console.log('Video generation resumed');
  }

  /**
   * Initialize empty queue
   */
  private initializeQueue(): VideoGenerationQueue {
    return {
      scenes: [],
      currentIndex: 0,
      totalScenes: 0,
      completed: [],
      failed: []
    };
  }
}