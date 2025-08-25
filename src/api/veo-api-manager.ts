/**
 * Veo API Manager for video generation using Google's GenAI SDK
 * Updated for Veo 3.0 API compatibility
 */

import { GoogleGenAI } from '@google/genai';
import { VideoResult } from '../types';
import { RetryHandler } from '../utils/retry-handler';

export interface VeoConfig {
  apiKey: string;
  maxRetries: number;
  pollInterval: number; // milliseconds
  timeout: number; // milliseconds
}

export interface VideoGenerationOptions {
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  quality?: 'draft' | 'standard' | 'high';
  model?: 'veo-3.0-generate-preview' | 'veo-3.0-fast-generate-preview';
  resolution?: '720p' | '1080p' | '4k';
}

export interface ImageToVideoOptions extends VideoGenerationOptions {
  imageBytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
}

export class VeoAPIManager {
  private ai: GoogleGenAI;
  private config: VeoConfig;
  private retryHandler: RetryHandler;

  constructor(config: VeoConfig) {
    this.config = {
      ...config,
      maxRetries: config.maxRetries || 3,
      pollInterval: config.pollInterval || 10000, // 10 seconds
      timeout: config.timeout || 300000, // 5 minutes
    };

    // Initialize with API key - the new SDK handles authentication automatically
    this.ai = new GoogleGenAI({});

    this.retryHandler = new RetryHandler({
      maxRetries: this.config.maxRetries,
      baseDelay: 1000,
      maxDelay: 10000
    });
  }

  /**
   * Generate video from text prompt using Veo 3.0
   */
  async generateTextToVideo(prompt: string, options: VideoGenerationOptions = {}): Promise<VideoResult> {
    return this.retryHandler.executeWithRetry(async () => {
      try {
        console.log('🎬 Starting Veo 3.0 text-to-video generation...');
        console.log(`📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
        
        // Use cost-effective model by default
        const model = options.model || "veo-3.0-fast-generate-preview";
        console.log(`🎯 Using model: ${model} (cost-optimized)`);
        
        // Start video generation operation using the new Veo 3.0 API
        let operation = await this.ai.models.generateVideos({
          model: model,
          prompt: prompt,
        });

        console.log('⏳ Video generation operation started, polling for completion...');
        console.log(`🔄 Operation ID: ${operation.name || 'N/A'}`);

        // Poll until completion with improved logging
        const startTime = Date.now();
        let pollCount = 0;
        
        while (!operation.done) {
          // Check timeout
          const elapsed = Date.now() - startTime;
          if (elapsed > this.config.timeout) {
            throw new Error(`Video generation timed out after ${elapsed / 1000} seconds`);
          }

          pollCount++;
          const elapsedMinutes = Math.floor(elapsed / 60000);
          const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
          console.log(`⏳ Poll ${pollCount}: Waiting for video generation (${elapsedMinutes}m ${elapsedSeconds}s elapsed)...`);
          
          await new Promise((resolve) => setTimeout(resolve, this.config.pollInterval));
          
          operation = await this.ai.operations.getVideosOperation({
            operation: operation,
          });
        }

        console.log('✅ Video generation completed!');

        if (!operation.response?.generatedVideos?.[0]?.video) {
          throw new Error('No video generated in response');
        }

        const generatedVideo = operation.response.generatedVideos[0];
        const videoFile = generatedVideo.video;

        // Generate local filename with timestamp
        const timestamp = Date.now();
        const filename = `veo3-text-to-video-${timestamp}.mp4`;
        const outputPath = `./output/videos/${filename}`;

        // Ensure output directory exists
        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Download the video
        console.log('📥 Downloading generated video...');
        if (videoFile) {
          await this.ai.files.download({
            file: videoFile,
            downloadPath: outputPath,
          });
        } else {
          throw new Error('Video file is undefined');
        }

        console.log(`✅ Video successfully saved to ${outputPath}`);

        // Get file stats for metadata
        const stats = await this.getFileStatsWithRetry(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Video file size: ${fileSizeMB} MB`);

        const resolution = options.resolution || '720p';
        console.log(`📐 Resolution: ${resolution} (cost-optimized)`);
        
        const videoResult: VideoResult = {
          url: outputPath,
          format: 'mp4',
          duration: options.duration || 5,
          width: this.getResolutionWidth(options.aspectRatio, resolution),
          height: this.getResolutionHeight(options.aspectRatio, resolution),
          size: stats.size
        };

        return videoResult;

      } catch (error) {
        console.error('❌ Veo 3.0 text-to-video generation failed:', error);
        throw new Error(`Veo 3.0 text-to-video generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 'Generate text-to-video with Veo 3.0');
  }

  /**
   * Generate video from image and text prompt using Veo 3.0
   */
  async generateImageToVideo(imageData: Uint8Array | string, mimeType: 'image/png' | 'image/jpeg', prompt: string, options: VideoGenerationOptions = {}): Promise<VideoResult> {
    return this.retryHandler.executeWithRetry(async () => {
      try {
        console.log('🎬 Starting Veo 3.0 image-to-video generation...');
        console.log(`🖼️ Image size: ${(imageData.length / 1024).toFixed(2)} KB (${mimeType})`);
        console.log(`📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        // Use cost-effective model by default
        const model = options.model || "veo-3.0-fast-generate-preview";
        console.log(`🎯 Using model: ${model} (cost-optimized)`);
        
        // Convert to base64 string as required by the API
        const base64String = typeof imageData === 'string' 
          ? imageData 
          : Buffer.from(imageData).toString('base64');
        
        // Start video generation operation with image input using new API
        let operation = await this.ai.models.generateVideos({
          model: model,
          prompt: prompt,
          image: {
            imageBytes: base64String,
            mimeType: mimeType,
          },
        });

        console.log('⏳ Image-to-video generation operation started, polling for completion...');
        console.log(`🔄 Operation ID: ${operation.name || 'N/A'}`);

        // Poll until completion with enhanced logging
        const startTime = Date.now();
        let pollCount = 0;
        
        while (!operation.done) {
          // Check timeout
          const elapsed = Date.now() - startTime;
          if (elapsed > this.config.timeout) {
            throw new Error(`Image-to-video generation timed out after ${elapsed / 1000} seconds`);
          }

          pollCount++;
          const elapsedMinutes = Math.floor(elapsed / 60000);
          const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
          console.log(`⏳ Poll ${pollCount}: Waiting for image-to-video generation (${elapsedMinutes}m ${elapsedSeconds}s elapsed)...`);
          
          await new Promise((resolve) => setTimeout(resolve, this.config.pollInterval));
          
          operation = await this.ai.operations.getVideosOperation({
            operation: operation,
          });
        }

        console.log('✅ Image-to-video generation completed!');

        if (!operation.response?.generatedVideos?.[0]?.video) {
          throw new Error('No video generated in response');
        }

        const generatedVideo = operation.response.generatedVideos[0];
        const videoFile = generatedVideo.video;

        // Generate local filename with timestamp
        const timestamp = Date.now();
        const filename = `veo3-image-to-video-${timestamp}.mp4`;
        const outputPath = `./output/videos/${filename}`;

        // Ensure output directory exists
        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Download the video
        console.log('📥 Downloading generated video...');
        if (videoFile) {
          await this.ai.files.download({
            file: videoFile,
            downloadPath: outputPath,
          });
        } else {
          throw new Error('Video file is undefined');
        }

        console.log(`✅ Video successfully saved to ${outputPath}`);

        // Get file stats for metadata
        const stats = await this.getFileStatsWithRetry(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Video file size: ${fileSizeMB} MB`);

        const resolution = options.resolution || '720p';
        console.log(`📐 Resolution: ${resolution} (cost-optimized)`);
        
        const videoResult: VideoResult = {
          url: outputPath,
          format: 'mp4',
          duration: options.duration || 5,
          width: this.getResolutionWidth(options.aspectRatio, resolution),
          height: this.getResolutionHeight(options.aspectRatio, resolution),
          size: stats.size
        };

        return videoResult;

      } catch (error) {
        console.error('❌ Veo 3.0 image-to-video generation failed:', error);
        throw new Error(`Veo 3.0 image-to-video generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 'Generate image-to-video with Veo 3.0');
  }

  /**
   * Generate image using Imagen (for image-to-video workflow)
   */
  async generateImage(prompt: string): Promise<{ imageBytes: Uint8Array; mimeType: 'image/png' }> {
    return this.retryHandler.executeWithRetry(async () => {
      try {
        console.log('🖼️ Generating image with Imagen...');

        const imagenResponse = await this.ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: prompt,
        });

        if (!imagenResponse.generatedImages?.[0]?.image?.imageBytes) {
          throw new Error('No image generated in response');
        }

        const imageBytes = imagenResponse.generatedImages[0].image.imageBytes;
        
        console.log('✅ Image generated successfully');

        // Convert string to Uint8Array if needed
        const uint8Array = typeof imageBytes === 'string' 
          ? new Uint8Array(Buffer.from(imageBytes, 'base64'))
          : new Uint8Array(imageBytes);
        
        return {
          imageBytes: uint8Array,
          mimeType: 'image/png' as const
        };

      } catch (error) {
        console.error('❌ Imagen generation failed:', error);
        throw new Error(`Imagen generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 'Generate image with Imagen');
  }

  /**
   * Complete image-to-video workflow (generate image first, then video)
   */
  async generateImageToVideoComplete(imagePrompt: string, videoPrompt: string, options: VideoGenerationOptions = {}): Promise<VideoResult> {
    try {
      console.log('🎬 Starting complete image-to-video workflow...');
      
      // Step 1: Generate image using Imagen
      console.log('🖼️ Step 1: Generating reference image with Imagen...');
      const imageResult = await this.generateImage(imagePrompt);
      
      // Step 2: Generate video from image using Veo 3.0
      console.log('🎥 Step 2: Generating video from image with Veo 3.0...');
      return await this.generateImageToVideo(
        imageResult.imageBytes,
        imageResult.mimeType,
        videoPrompt,
        options
      );
    } catch (error) {
      console.error('❌ Complete image-to-video workflow failed:', error);
      throw new Error(`Complete image-to-video workflow failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Safely get file stats with retry for race conditions
   */
  private async getFileStatsWithRetry(filePath: string): Promise<{ size: number }> {
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const fs = await import('fs/promises');
        return await fs.stat(filePath);
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(`⚠️ Could not get file stats for ${filePath} after ${maxRetries} attempts, but file was created successfully`);
          return { size: 0 };
        }
        console.log(`⏳ Retrying file stat (attempt ${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { size: 0 };
  }

  /**
   * Get resolution width based on aspect ratio and resolution setting
   */
  private getResolutionWidth(aspectRatio?: '16:9' | '9:16' | '1:1', resolution: '720p' | '1080p' | '4k' = '720p'): number {
    const resolutionMap = {
      '720p': { '16:9': 1280, '9:16': 720, '1:1': 720 },
      '1080p': { '16:9': 1920, '9:16': 1080, '1:1': 1080 },
      '4k': { '16:9': 3840, '9:16': 2160, '1:1': 2160 }
    };
    
    const ratio = aspectRatio || '16:9';
    return resolutionMap[resolution][ratio];
  }

  /**
   * Get resolution height based on aspect ratio and resolution setting
   */
  private getResolutionHeight(aspectRatio?: '16:9' | '9:16' | '1:1', resolution: '720p' | '1080p' | '4k' = '720p'): number {
    const resolutionMap = {
      '720p': { '16:9': 720, '9:16': 1280, '1:1': 720 },
      '1080p': { '16:9': 1080, '9:16': 1920, '1:1': 1080 },
      '4k': { '16:9': 2160, '9:16': 3840, '1:1': 2160 }
    };
    
    const ratio = aspectRatio || '16:9';
    return resolutionMap[resolution][ratio];
  }
}