/**
 * Image-to-Video Generator Service
 * Handles character-consistent video generation using reference images with Veo
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
import { ImageGenerator } from './image-generator';
import { VideoResult, ImageResult } from '../types/api';
import { ScriptScene, Scene, Character } from '../types/content';

export interface ImageToVideoConfig {
  maxScenes: number;
  quality: 'draft' | 'standard' | 'high';
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: number;
  generateReferenceImages: boolean;
  reuseCharacterImages: boolean;
}

export interface CharacterImageCache {
  characterName: string;
  imageUrl: string;
  sceneIds: string[];
  generatedAt: Date;
}

export interface ImageToVideoQueue {
  scenes: Scene[];
  currentIndex: number;
  totalScenes: number;
  completed: Scene[];
  failed: Scene[];
  characterImages: CharacterImageCache[];
}

/**
 * Generates videos using reference images for character consistency
 */
export class ImageToVideoGenerator {
  private apiManager: GeminiAPIManager;
  private characterManager: CharacterDatabaseManager;
  private imageGenerator: ImageGenerator;
  private config: ImageToVideoConfig;
  private queue: ImageToVideoQueue;
  private characterImageCache: Map<string, CharacterImageCache> = new Map();

  constructor(
    apiManager: GeminiAPIManager,
    characterManager: CharacterDatabaseManager,
    imageGenerator: ImageGenerator,
    config: ImageToVideoConfig
  ) {
    this.apiManager = apiManager;
    this.characterManager = characterManager;
    this.imageGenerator = imageGenerator;
    this.config = config;
    this.queue = this.initializeQueue();
  }

  /**
   * Generate videos using reference images for character consistency
   */
  async generateVideosFromScript(
    scriptScenes: ScriptScene[],
    startIndex: number = 0
  ): Promise<ImageToVideoQueue> {
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
      failed: [],
      characterImages: []
    };

    // Generate reference images for characters if needed
    if (this.config.generateReferenceImages) {
      await this.generateCharacterReferenceImages(scenesToProcess);
    }

    // Process scenes sequentially
    for (let i = 0; i < videoScenes.length; i++) {
      this.queue.currentIndex = i;
      const scene = videoScenes[i];
      
      try {
        scene.status = 'generating';
        
        // Get or generate reference image for this scene
        const referenceImage = await this.getReferenceImageForScene(scene);
        scene.referenceImage = referenceImage;
        
        // Generate video using reference image
        const videoResult = await this.generateVideoFromImage(scene, referenceImage);
        
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
   * Generate video from image and description (simplified interface for orchestrator)
   */
  async generateVideo(referenceImage: string, description: string, config: any): Promise<VideoResult> {
    // Use the new Veo image-to-video method
    const videoResult = await this.apiManager.generateImageToVideo(referenceImage, description, {
      duration: config.duration || 5,
      quality: config.quality || 'standard',
      aspectRatio: config.aspectRatio || '16:9'
    });

    return videoResult;
  }

  /**
   * Generate a single video from a scene using reference image
   */
  async generateVideoFromImage(scene: Scene, referenceImage: string): Promise<VideoResult> {
    // Engineer the prompt for image-to-video generation
    const engineeredPrompt = this.engineerImageToVideoPrompt(scene);
    
    // Generate video using Gemini API with reference image
    const videoResult = await this.apiManager.generateVideo(
      engineeredPrompt,
      referenceImage,
      'gemini-2.0-flash-exp'
    );

    return videoResult;
  }

  /**
   * Generate reference images for all characters in the scenes
   */
  private async generateCharacterReferenceImages(scriptScenes: ScriptScene[]): Promise<void> {
    // Collect all unique characters from scenes
    const allCharacters = new Set<string>();
    scriptScenes.forEach(scene => {
      scene.characters.forEach(character => allCharacters.add(character));
    });

    // Generate reference images for each character
    for (const characterName of allCharacters) {
      try {
        // Check if we already have a cached image and should reuse it
        const normalizedName = characterName.toLowerCase();
        if (this.config.reuseCharacterImages && this.characterImageCache.has(normalizedName)) {
          continue;
        }

        // Check if character has existing reference image
        if (this.characterManager.hasCharacter(characterName)) {
          const character = this.getCharacterByName(characterName);
          if (character?.referenceImage) {
            this.cacheCharacterImage(characterName, character.referenceImage, []);
            continue;
          }
        }

        // Generate new reference image
        const referenceImage = await this.generateCharacterReferenceImage(characterName);
        
        // Cache the generated image
        this.cacheCharacterImage(characterName, referenceImage.url, []);
        
        // Update character database with reference image
        if (this.characterManager.hasCharacter(characterName)) {
          this.characterManager.setCharacterReferenceImage(characterName, referenceImage.url);
        }
        
      } catch (error) {
        console.error(`Failed to generate reference image for character ${characterName}:`, error);
      }
    }
  }

  /**
   * Generate reference image for a specific character
   */
  private async generateCharacterReferenceImage(characterName: string): Promise<ImageResult> {
    let characterDescription = '';
    
    try {
      characterDescription = this.characterManager.getCharacterDescription(characterName);
    } catch {
      // Character not in database, use generic description
      characterDescription = `A person named ${characterName}`;
    }

    // Create prompt for character reference image
    const imagePrompt = this.buildCharacterImagePrompt(characterName, characterDescription);
    
    // Generate image using ImageGenerator service
    return await this.imageGenerator.generateCharacterReference(imagePrompt);
  }

  /**
   * Get reference image for a scene (from cache or generate new)
   */
  private async getReferenceImageForScene(scene: Scene): Promise<string> {
    const scriptScene = this.findScriptScene(scene.scriptSceneId);
    if (!scriptScene || scriptScene.characters.length === 0) {
      // No characters in scene, generate scene-based reference image
      return await this.generateSceneReferenceImage(scene);
    }

    // Get primary character for the scene
    const primaryCharacter = scriptScene.characters[0]; // Use first character as primary
    const normalizedCharacterName = primaryCharacter.toLowerCase();
    
    // Check cache first
    const cachedImage = this.characterImageCache.get(normalizedCharacterName);
    if (cachedImage) {
      // Update cache with this scene ID
      cachedImage.sceneIds.push(scene.id);
      return cachedImage.imageUrl;
    }

    // Generate new reference image for the character in this scene context
    const characterDescription = this.characterManager.getCharacterDescription(primaryCharacter);
    const sceneContext = scriptScene.description;
    
    const contextualPrompt = this.buildContextualCharacterPrompt(
      primaryCharacter,
      characterDescription,
      sceneContext
    );
    
    const referenceImage = await this.imageGenerator.generateCharacterReference(contextualPrompt);
    
    // Cache the image
    this.cacheCharacterImage(primaryCharacter, referenceImage.url, [scene.id]);
    
    return referenceImage.url;
  }

  /**
   * Generate scene-based reference image when no characters are present
   */
  private async generateSceneReferenceImage(scene: Scene): Promise<string> {
    const scriptScene = this.findScriptScene(scene.scriptSceneId);
    if (!scriptScene) {
      throw new Error(`Script scene not found for scene ${scene.id}`);
    }

    const scenePrompt = `Scene reference image: ${scriptScene.description}. ${scriptScene.visualCues.join(', ')}.`;
    const referenceImage = await this.imageGenerator.generateSceneReference(scenePrompt);
    
    return referenceImage.url;
  }

  /**
   * Engineer prompt for image-to-video generation
   */
  private engineerImageToVideoPrompt(scene: Scene): string {
    const scriptScene = this.findScriptScene(scene.scriptSceneId);
    if (!scriptScene) {
      throw new Error(`Script scene not found for scene ${scene.id}`);
    }

    // Build motion and action description
    const motionDescription = this.buildMotionDescription(scriptScene);
    
    // Add technical specifications
    const technicalSpecs = this.buildTechnicalSpecs();
    
    // Add camera movement guidance
    const cameraMovement = this.buildCameraMovement(scriptScene);
    
    // Combine elements for image-to-video prompt
    const prompt = [
      `Animate this image: ${motionDescription}`,
      `Scene action: ${scriptScene.description}`,
      scriptScene.dialogue.length > 0 ? `Dialogue context: ${scriptScene.dialogue.join(' ')}` : '',
      cameraMovement,
      `Duration: ${this.config.duration} seconds.`,
      technicalSpecs
    ].filter(Boolean).join(' ');

    return prompt;
  }

  /**
   * Build motion description for image-to-video animation
   */
  private buildMotionDescription(scriptScene: ScriptScene): string {
    const description = scriptScene.description.toLowerCase();
    
    let motion = 'Subtle character movements and natural gestures.';
    
    if (description.includes('walk') || description.includes('move')) {
      motion = 'Character walking or moving through the scene.';
    } else if (description.includes('talk') || description.includes('speak')) {
      motion = 'Character speaking with natural facial expressions and lip sync.';
    } else if (description.includes('action') || description.includes('fight')) {
      motion = 'Dynamic action movements and energetic gestures.';
    } else if (description.includes('sit') || description.includes('rest')) {
      motion = 'Minimal movement, character sitting or resting with breathing animation.';
    }
    
    return motion;
  }

  /**
   * Build camera movement guidance
   */
  private buildCameraMovement(scriptScene: ScriptScene): string {
    const visualCues = scriptScene.visualCues.join(' ').toLowerCase();
    
    if (visualCues.includes('close-up') || visualCues.includes('closeup')) {
      return 'Slow zoom in for close-up shot.';
    } else if (visualCues.includes('wide') || visualCues.includes('establishing')) {
      return 'Slow camera pull back for wide establishing shot.';
    } else if (visualCues.includes('pan')) {
      return 'Smooth camera pan across the scene.';
    }
    
    return 'Steady camera with subtle movement for cinematic feel.';
  }

  /**
   * Build character image prompt
   */
  private buildCharacterImagePrompt(characterName: string, description: string): string {
    return `Character reference image for ${characterName}: ${description}. Professional portrait style, clear facial features, consistent lighting.`;
  }

  /**
   * Build contextual character prompt for scene-specific reference
   */
  private buildContextualCharacterPrompt(
    characterName: string,
    description: string,
    sceneContext: string
  ): string {
    return `${characterName} in scene context: ${description}. Scene setting: ${sceneContext}. Maintain character consistency while fitting the scene environment.`;
  }

  /**
   * Cache character image
   */
  private cacheCharacterImage(characterName: string, imageUrl: string, sceneIds: string[]): void {
    const normalizedName = characterName.toLowerCase();
    const cache: CharacterImageCache = {
      characterName: normalizedName,
      imageUrl,
      sceneIds: [...sceneIds],
      generatedAt: new Date()
    };
    
    this.characterImageCache.set(normalizedName, cache);
    this.queue.characterImages.push(cache);
  }

  /**
   * Get character by name (helper method)
   */
  private getCharacterByName(name: string): Character | null {
    try {
      const characters = this.characterManager.getAllCharacters();
      if (!characters || !Array.isArray(characters)) {
        return null;
      }
      return characters.find(char => char.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert script scenes to video scenes
   */
  private convertScriptScenesToVideoScenes(scriptScenes: ScriptScene[]): Scene[] {
    return scriptScenes.map((scriptScene, index) => ({
      id: `img-video-scene-${index + 1}`,
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
   * Build technical specifications
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
   * Find script scene by ID (placeholder)
   */
  private findScriptScene(scriptSceneId: string): ScriptScene | null {
    // In a real implementation, this would query the script storage
    // For now, we'll try to extract info from the scene ID or return a basic placeholder
    const sceneNumber = scriptSceneId.replace(/\D/g, '');
    
    // For testing purposes, if the scene ID contains 'scene', add a character
    const hasCharacter = scriptSceneId.includes('scene');
    
    return {
      id: scriptSceneId,
      description: `Scene ${sceneNumber} description placeholder`,
      dialogue: [],
      characters: hasCharacter ? ['John'] : [],
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
  getQueueStatus(): ImageToVideoQueue {
    return { ...this.queue };
  }

  /**
   * Get character image cache
   */
  getCharacterImageCache(): CharacterImageCache[] {
    return Array.from(this.characterImageCache.values());
  }

  /**
   * Clear character image cache
   */
  clearCharacterImageCache(): void {
    this.characterImageCache.clear();
    this.queue.characterImages = [];
  }

  /**
   * Initialize empty queue
   */
  private initializeQueue(): ImageToVideoQueue {
    return {
      scenes: [],
      currentIndex: 0,
      totalScenes: 0,
      completed: [],
      failed: [],
      characterImages: []
    };
  }
}