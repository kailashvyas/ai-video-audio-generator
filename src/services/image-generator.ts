/**
 * Image Generator service for character reference images
 * Handles character-consistent image generation using Gemini Vision
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { ImageResult } from '../types/api';
import { Character } from '../types/content';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImageGenerationConfig {
  style: 'realistic' | 'animated' | 'artistic';
  quality: 'draft' | 'standard' | 'high';
  aspectRatio: '1:1' | '16:9' | '4:3';
  resolution: 'low' | 'medium' | 'high';
}

export interface CharacterImageRequest {
  character: Character;
  config: ImageGenerationConfig;
  additionalPrompts?: string[];
}

export interface ImageValidationResult {
  isValid: boolean;
  quality: number; // 0-1 score
  issues: string[];
  suggestions: string[];
}

export interface StoredImage {
  id: string;
  characterName: string;
  filePath: string;
  url: string;
  metadata: ImageMetadata;
  createdAt: Date;
}

export interface ImageMetadata {
  prompt: string;
  config: ImageGenerationConfig;
  validationResult: ImageValidationResult;
  fileSize: number;
  dimensions: { width: number; height: number };
}

export class ImageGenerator {
  private apiManager: GeminiAPIManager;
  private storageDir: string;

  constructor(apiManager: GeminiAPIManager, storageDir: string = './generated-images') {
    this.apiManager = apiManager;
    this.storageDir = storageDir;
    // Note: ensureStorageDirectory is called async in methods that need it
  }

  /**
   * Generate character reference image
   */
  async generateCharacterImage(request: CharacterImageRequest): Promise<StoredImage> {
    await this.ensureStorageDirectory();
    const prompt = this.buildCharacterPrompt(request);
    
    try {
      // Generate image using Gemini Vision
      const imageResult = await this.apiManager.generateImage(prompt);
      
      // Validate the generated image
      const validationResult = await this.validateImage(imageResult, request);
      
      if (!validationResult.isValid || validationResult.quality < 0.6) {
        throw new Error(`Generated image quality too low: ${validationResult.issues.join(', ')}`);
      }

      // Store the image
      const storedImage = await this.storeImage(imageResult, request, validationResult);
      
      return storedImage;
    } catch (error) {
      throw new Error(`Failed to generate character image: ${error.message}`);
    }
  }

  /**
   * Build optimized prompt for character image generation
   */
  private buildCharacterPrompt(request: CharacterImageRequest): string {
    const { character, config, additionalPrompts = [] } = request;
    
    const stylePrompts = {
      realistic: 'photorealistic, high detail, professional photography',
      animated: 'animated style, cartoon-like, vibrant colors',
      artistic: 'artistic rendering, stylized, creative interpretation'
    };

    const qualityPrompts = {
      draft: 'quick sketch, basic details',
      standard: 'good quality, clear features',
      high: 'ultra high quality, exceptional detail, masterpiece'
    };

    const resolutionPrompts = {
      low: '512x512',
      medium: '1024x1024', 
      high: '2048x2048'
    };

    const basePrompt = [
      `Character reference image of ${character.name}`,
      character.description,
      stylePrompts[config.style],
      qualityPrompts[config.quality],
      `aspect ratio ${config.aspectRatio}`,
      `resolution ${resolutionPrompts[config.resolution]}`,
      'clear facial features, consistent appearance',
      'suitable for character reference',
      ...additionalPrompts
    ].join(', ');

    return basePrompt;
  }

  /**
   * Validate generated image quality and consistency
   */
  private async validateImage(
    imageResult: ImageResult, 
    request: CharacterImageRequest
  ): Promise<ImageValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let quality = 1.0;

    // Check image dimensions
    const expectedDimensions = this.getExpectedDimensions(request.config);
    if (imageResult.width !== expectedDimensions.width || imageResult.height !== expectedDimensions.height) {
      issues.push('Incorrect image dimensions');
      quality -= 0.2;
    }

    // Check file size (basic quality indicator)
    const minSize = expectedDimensions.width * expectedDimensions.height * 0.5; // More strict estimate
    if (imageResult.size < minSize) {
      issues.push('Image file size too small, may indicate low quality');
      quality -= 0.5; // More severe penalty
      suggestions.push('Try increasing quality setting');
    }

    // Check format
    if (!['png', 'jpg', 'jpeg'].includes(imageResult.format.toLowerCase())) {
      issues.push('Unsupported image format');
      quality -= 0.1;
    }

    // Additional validation could include:
    // - Face detection to ensure character is visible
    // - Color analysis for consistency
    // - Blur detection for sharpness

    return {
      isValid: issues.length === 0 || quality >= 0.5,
      quality: Math.max(0, quality),
      issues,
      suggestions
    };
  }

  /**
   * Store image with metadata
   */
  private async storeImage(
    imageResult: ImageResult,
    request: CharacterImageRequest,
    validationResult: ImageValidationResult
  ): Promise<StoredImage> {
    const imageId = this.generateImageId(request.character.name);
    const fileName = `${imageId}.${imageResult.format}`;
    const filePath = path.join(this.storageDir, fileName);

    // In a real implementation, we would download and save the actual image file
    // For now, we'll create a placeholder file
    await fs.writeFile(filePath, `Placeholder image for ${request.character.name}`);

    const storedImage: StoredImage = {
      id: imageId,
      characterName: request.character.name,
      filePath,
      url: imageResult.url,
      metadata: {
        prompt: this.buildCharacterPrompt(request),
        config: request.config,
        validationResult,
        fileSize: imageResult.size,
        dimensions: {
          width: imageResult.width,
          height: imageResult.height
        }
      },
      createdAt: new Date()
    };

    // Save metadata
    await this.saveImageMetadata(storedImage);

    return storedImage;
  }

  /**
   * Retrieve stored character image
   */
  async getCharacterImage(characterName: string): Promise<StoredImage | null> {
    try {
      const metadataPath = path.join(this.storageDir, `${characterName}-metadata.json`);
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all stored character images
   */
  async listCharacterImages(): Promise<StoredImage[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
      
      const images: StoredImage[] = [];
      for (const file of metadataFiles) {
        try {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8');
          images.push(JSON.parse(content));
        } catch (error) {
          // Skip corrupted metadata files
          continue;
        }
      }
      
      return images;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete character image and metadata
   */
  async deleteCharacterImage(characterName: string): Promise<boolean> {
    try {
      const image = await this.getCharacterImage(characterName);
      if (!image) return false;

      // Delete image file
      await fs.unlink(image.filePath);
      
      // Delete metadata file
      const metadataPath = path.join(this.storageDir, `${characterName}-metadata.json`);
      await fs.unlink(metadataPath);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update character image with new generation
   */
  async updateCharacterImage(request: CharacterImageRequest): Promise<StoredImage> {
    // Delete existing image if it exists
    await this.deleteCharacterImage(request.character.name);
    
    // Generate new image
    return this.generateCharacterImage(request);
  }

  /**
   * Get expected dimensions based on config
   */
  private getExpectedDimensions(config: ImageGenerationConfig): { width: number; height: number } {
    const resolutions = {
      low: { width: 512, height: 512 },
      medium: { width: 1024, height: 1024 },
      high: { width: 2048, height: 2048 }
    };

    const baseDimensions = resolutions[config.resolution];

    // Adjust for aspect ratio
    switch (config.aspectRatio) {
      case '16:9':
        return {
          width: baseDimensions.width,
          height: Math.round(baseDimensions.width * 9 / 16)
        };
      case '4:3':
        return {
          width: baseDimensions.width,
          height: Math.round(baseDimensions.width * 3 / 4)
        };
      case '1:1':
      default:
        return baseDimensions;
    }
  }

  /**
   * Generate unique image ID
   */
  private generateImageId(characterName: string): string {
    const timestamp = Date.now();
    const sanitizedName = characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitizedName}-${timestamp}`;
  }

  /**
   * Save image metadata to file
   */
  private async saveImageMetadata(image: StoredImage): Promise<void> {
    const metadataPath = path.join(this.storageDir, `${image.characterName}-metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(image, null, 2));
  }

  /**
   * Generate character reference image (simplified interface for video generation)
   */
  async generateCharacterReference(prompt: string): Promise<ImageResult> {
    try {
      return await this.apiManager.generateImage(prompt);
    } catch (error) {
      throw new Error(`Failed to generate character reference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate scene reference image (for scenes without characters)
   */
  async generateSceneReference(prompt: string): Promise<ImageResult> {
    try {
      const scenePrompt = `Scene reference image: ${prompt}. Cinematic composition, professional lighting, detailed environment.`;
      return await this.apiManager.generateImage(scenePrompt);
    } catch (error) {
      throw new Error(`Failed to generate scene reference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch (error) {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }
}