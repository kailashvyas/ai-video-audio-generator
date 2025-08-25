/**
 * Gemini API Manager with rate limiting and cost tracking
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { APIOperation, APIError, ImageResult, VideoResult, AudioResult, VoiceConfig, UsageStats } from '../types';
import { RetryHandler } from '../utils/retry-handler';
import { VeoAPIManager } from './veo-api-manager';

export interface GeminiConfig {
  apiKey: string;
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
  defaultModel: string;
}

export interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number;
  lastRefill: number;
}

export class GeminiAPIManager {
  private genAI: GoogleGenerativeAI;
  private genAINew: GoogleGenAI; // New SDK for Veo 3.0 and Imagen
  private veoManager: VeoAPIManager;
  private config: GeminiConfig;
  private tokenBucket: TokenBucket;
  private activeRequests: number = 0;
  private usageStats: UsageStats;
  private retryHandler: RetryHandler;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.genAINew = new GoogleGenAI({}); // New SDK for Veo 3.0 and Imagen
    
    // Initialize Veo API manager for video generation with updated config
    this.veoManager = new VeoAPIManager({
      apiKey: config.apiKey,
      maxRetries: 3,
      pollInterval: 10000,
      timeout: 300000
    });
    
    // Initialize token bucket for rate limiting
    this.tokenBucket = {
      tokens: config.maxRequestsPerMinute,
      maxTokens: config.maxRequestsPerMinute,
      refillRate: config.maxRequestsPerMinute / 60, // tokens per second
      lastRefill: Date.now()
    };

    // Initialize usage stats
    this.usageStats = {
      totalCost: 0,
      requestCount: 0,
      tokensUsed: 0,
      quotaRemaining: 1000000 // Default quota
    };

    // Initialize retry handler
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBase: 2,
      jitter: true
    });
  }

  /**
   * Generate text content using Gemini Pro
   */
  async generateText(prompt: string, model: string = 'gemini-pro'): Promise<string> {
    return this.retryHandler.executeWithRetry(async () => {
      await this.checkRateLimit();
      
      try {
        this.activeRequests++;
        const operation: APIOperation = {
          type: 'text',
          model,
          inputSize: prompt.length,
          complexity: 'medium'
        };

        const cost = this.estimateCost(operation);
        this.updateUsageStats(cost, prompt.length);

        const generativeModel = this.genAI.getGenerativeModel({ model });
        const result = await generativeModel.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        throw this.handleAPIError(error);
      } finally {
        this.activeRequests--;
      }
    }, `Generate text with model ${model}`);
  }

  /**
   * Generate image using Imagen 3.0
   */
  async generateImage(prompt: string, model: string = 'imagen-3.0-generate-002'): Promise<ImageResult> {
    return this.retryHandler.executeWithRetry(async () => {
      await this.checkRateLimit();
      
      try {
        this.activeRequests++;
        const operation: APIOperation = {
          type: 'image',
          model,
          inputSize: prompt.length,
          complexity: 'high'
        };

        const cost = this.estimateCost(operation);
        this.updateUsageStats(cost, prompt.length);

        console.log('🖼️ Generating image with Imagen 3.0...');
        console.log(`📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        // Use the new Imagen API through the updated SDK
        const imagenResponse = await this.genAINew.models.generateImages({
          model: model,
          prompt: prompt,
        });

        if (!imagenResponse.generatedImages?.[0]?.image?.imageBytes) {
          throw new Error('No image generated in response');
        }

        const imageBytes = imagenResponse.generatedImages[0].image.imageBytes;
        
        // Save image to local file
        const timestamp = Date.now();
        const filename = `imagen-generated-${timestamp}.png`;
        const outputPath = `./output/images/${filename}`;

        // Ensure output directory exists
        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Write image bytes to file
        await fs.writeFile(outputPath, imageBytes);
        
        console.log(`✅ Image saved to ${outputPath}`);

        // Get file stats
        const stats = await fs.stat(outputPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 Image file size: ${fileSizeMB} MB`);

        const imageResult: ImageResult = {
          url: outputPath,
          format: 'png',
          width: 1024, // Imagen default resolution
          height: 1024,
          size: stats.size
        };

        return imageResult;
      } catch (error) {
        console.error('❌ Imagen generation failed:', error);
        throw this.handleAPIError(error);
      } finally {
        this.activeRequests--;
      }
    }, `Generate image with Imagen ${model}`);
  }

  /**
   * Generate video using Veo API
   */
  async generateVideo(prompt: string, referenceImage?: string, model: string = 'veo-3.0-fast-generate-preview'): Promise<VideoResult> {
    await this.checkRateLimit();
    
    try {
      this.activeRequests++;
      const operation: APIOperation = {
        type: 'video',
        model,
        inputSize: prompt.length + (referenceImage ? 1000 : 0),
        complexity: 'high'
      };

      const cost = this.estimateCost(operation);
      this.updateUsageStats(cost, prompt.length);

      let videoResult: VideoResult;

      if (referenceImage) {
        // Image-to-video generation
        let mimeType: 'image/png' | 'image/jpeg';

        if (referenceImage.startsWith('data:')) {
          // Base64 encoded image
          mimeType = referenceImage.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
          const base64Data = referenceImage.split(',')[1];
          
          videoResult = await this.veoManager.generateImageToVideo(base64Data, mimeType, prompt, {
            resolution: '720p', // Cost-optimized default
            model: 'veo-3.0-fast-generate-preview'
          });
        } else {
          // File path - read and convert to base64 string format expected by Veo API
          const fs = await import('fs/promises');
          const imageBuffer = await fs.readFile(referenceImage);
          const base64String = imageBuffer.toString('base64');
          mimeType = referenceImage.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          
          videoResult = await this.veoManager.generateImageToVideo(base64String, mimeType, prompt, {
            resolution: '720p', // Cost-optimized default
            model: 'veo-3.0-fast-generate-preview'
          });
        }
      } else {
        // Text-to-video generation
        videoResult = await this.veoManager.generateTextToVideo(prompt, {
          resolution: '720p', // Cost-optimized default
          model: 'veo-3.0-fast-generate-preview'
        });
      }

      return videoResult;
    } catch (error) {
      throw this.handleAPIError(error);
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Generate video from text prompt using Veo
   */
  async generateTextToVideo(prompt: string, options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    quality?: 'draft' | 'standard' | 'high';
  } = {}): Promise<VideoResult> {
    // Enhance prompt with technical specifications
    const enhancedPrompt = this.buildVeoPrompt(prompt, options);
    return this.generateVideo(enhancedPrompt);
  }

  /**
   * Generate video from image and text prompt using Veo
   */
  async generateImageToVideo(imageData: string, prompt: string, options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    quality?: 'draft' | 'standard' | 'high';
  } = {}): Promise<VideoResult> {
    // Enhance prompt for image-to-video generation
    const enhancedPrompt = this.buildVeoPrompt(prompt, options, true);
    return this.generateVideo(enhancedPrompt, imageData);
  }

  /**
   * Build optimized prompt for Veo video generation
   */
  private buildVeoPrompt(prompt: string, options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    quality?: 'draft' | 'standard' | 'high';
  }, isImageToVideo: boolean = false): string {
    const duration = options.duration || 5;
    const aspectRatio = options.aspectRatio || '16:9';
    const quality = options.quality || 'standard';

    let enhancedPrompt = prompt;

    // Add technical specifications
    enhancedPrompt += `\n\nTechnical specifications:`;
    enhancedPrompt += `\n- Duration: ${duration} seconds`;
    enhancedPrompt += `\n- Aspect ratio: ${aspectRatio}`;
    enhancedPrompt += `\n- Quality: ${quality}`;

    // Add style guidance based on quality
    if (quality === 'high') {
      enhancedPrompt += `\n- High resolution, cinematic quality`;
      enhancedPrompt += `\n- Smooth motion, professional lighting`;
    } else if (quality === 'draft') {
      enhancedPrompt += `\n- Quick generation, basic quality`;
    }

    // Add specific guidance for image-to-video
    if (isImageToVideo) {
      enhancedPrompt += `\n- Animate the provided image naturally`;
      enhancedPrompt += `\n- Maintain character consistency`;
      enhancedPrompt += `\n- Smooth transitions and realistic motion`;
    }

    return enhancedPrompt;
  }

  /**
   * Generate audio using text-to-speech
   */
  async generateAudio(text: string, _voiceConfig: VoiceConfig): Promise<AudioResult> {
    return this.retryHandler.executeWithRetry(async () => {
      await this.checkRateLimit();
      
      try {
        this.activeRequests++;
        const operation: APIOperation = {
          type: 'audio',
          model: 'text-to-speech',
          inputSize: text.length,
          complexity: 'medium'
        };

        const cost = this.estimateCost(operation);
        this.updateUsageStats(cost, text.length);

        // Note: In a real implementation, this would use the voice configuration
        // for actual TTS API calls with the provided settings

        // Placeholder implementation - would integrate with Google TTS API
        const audioResult: AudioResult = {
          url: `generated-audio-${Date.now()}.mp3`,
          format: 'mp3',
          duration: Math.ceil(text.length / 10), // Rough estimate: 10 chars per second
          sampleRate: 44100,
          size: Math.ceil(text.length / 10) * 128000 / 8 // 128kbps estimate
        };

        return audioResult;
      } catch (error) {
        throw this.handleAPIError(error);
      } finally {
        this.activeRequests--;
      }
    }, 'Generate audio with TTS');
  }

  /**
   * Check rate limiting using token bucket algorithm
   */
  private async checkRateLimit(): Promise<void> {
    // Refill tokens based on time elapsed
    const now = Date.now();
    const timeDelta = (now - this.tokenBucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timeDelta * this.tokenBucket.refillRate;
    
    this.tokenBucket.tokens = Math.min(
      this.tokenBucket.maxTokens,
      this.tokenBucket.tokens + tokensToAdd
    );
    this.tokenBucket.lastRefill = now;

    // Check if we have tokens available
    if (this.tokenBucket.tokens < 1) {
      const waitTime = (1 - this.tokenBucket.tokens) / this.tokenBucket.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit();
    }

    // Check concurrent request limit
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.checkRateLimit();
    }

    // Consume a token
    this.tokenBucket.tokens -= 1;
  }

  /**
   * Estimate cost for API operations
   */
  estimateCost(operation: APIOperation): number {
    const baseCosts = {
      text: 0.001, // $0.001 per 1K characters
      image: 0.01, // $0.01 per image
      video: 0.10, // $0.10 per video (placeholder)
      audio: 0.005 // $0.005 per minute
    };

    const complexityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 2.0
    };

    const baseCost = baseCosts[operation.type];
    const multiplier = complexityMultiplier[operation.complexity];
    const sizeFactor = operation.inputSize / 1000; // per 1K units

    return baseCost * multiplier * Math.max(1, sizeFactor);
  }

  /**
   * Handle API errors with retry logic
   */
  private handleAPIError(error: any): APIError {
    const retryAfter = this.getRetryDelay(error);
    const apiError: APIError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      retryable: this.isRetryableError(error),
      ...(retryAfter !== undefined && { retryAfter })
    };

    return apiError;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = ['RATE_LIMIT_EXCEEDED', 'TEMPORARY_FAILURE', 'TIMEOUT'];
    return retryableCodes.includes(error.code) || error.status >= 500;
  }

  /**
   * Get retry delay for rate limiting
   */
  private getRetryDelay(error: any): number | undefined {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return error.retryAfter || 60000; // 1 minute default
    }
    return undefined;
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(cost: number, tokensUsed: number): void {
    this.usageStats.totalCost += cost;
    this.usageStats.requestCount += 1;
    this.usageStats.tokensUsed += tokensUsed;
    this.usageStats.quotaRemaining = Math.max(0, this.usageStats.quotaRemaining - tokensUsed);
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = {
      totalCost: 0,
      requestCount: 0,
      tokensUsed: 0,
      quotaRemaining: 1000000
    };
  }
}