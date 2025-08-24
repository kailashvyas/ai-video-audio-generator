/**
 * Gemini API Manager with rate limiting and cost tracking
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { APIOperation, APIError, ImageResult, VideoResult, AudioResult, VoiceConfig, UsageStats } from '../types';
import { RetryHandler } from '../utils/retry-handler';

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
  private config: GeminiConfig;
  private tokenBucket: TokenBucket;
  private activeRequests: number = 0;
  private usageStats: UsageStats;
  private retryHandler: RetryHandler;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    
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
   * Generate image using Gemini Vision
   */
  async generateImage(prompt: string, model: string = 'gemini-2.0-flash-exp'): Promise<ImageResult> {
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

        const generativeModel = this.genAI.getGenerativeModel({ model });
        
        // For image generation, we'll use a specific prompt format
        const imagePrompt = `Generate an image: ${prompt}`;
        await generativeModel.generateContent(imagePrompt);
        // Note: In a real implementation, this would extract image data from the response
        
        // Note: This is still a placeholder implementation
        // Actual image generation would extract the image data from the response
        const imageResult: ImageResult = {
          url: `generated-image-${Date.now()}.png`,
          format: 'png',
          width: 1024,
          height: 1024,
          size: 2048000 // 2MB placeholder
        };

        return imageResult;
      } catch (error) {
        throw this.handleAPIError(error);
      } finally {
        this.activeRequests--;
      }
    }, `Generate image with model ${model}`);
  }

  /**
   * Generate video using Veo through Gemini API
   */
  async generateVideo(prompt: string, referenceImage?: string, model: string = 'gemini-2.0-flash-exp'): Promise<VideoResult> {
    return this.retryHandler.executeWithRetry(async () => {
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

        const generativeModel = this.genAI.getGenerativeModel({ model });
        
        // Prepare the request parts
        const parts: any[] = [{ text: prompt }];
        
        // Add reference image if provided
        if (referenceImage) {
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg', // Assume JPEG, could be made configurable
              data: referenceImage // Should be base64 encoded image data
            }
          });
        }

        await generativeModel.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        });

        // Note: In a real implementation, this would process the actual video response
        // const response = result.response;
        // const videoData = response.text();
        
        // In a real implementation, this would return the actual video URL/data
        // For now, we'll simulate the response structure
        const videoResult: VideoResult = {
          url: `generated-video-${Date.now()}.mp4`,
          format: 'mp4',
          duration: 5, // Would be extracted from actual response
          width: 1920,
          height: 1080,
          size: 10485760 // Would be actual file size
        };

        return videoResult;
      } catch (error) {
        throw this.handleAPIError(error);
      } finally {
        this.activeRequests--;
      }
    }, `Generate video with model ${model}`);
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