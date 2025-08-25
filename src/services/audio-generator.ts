/**
 * Audio Generator service for narration using Gemini text-to-speech
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { AudioResult, VoiceConfig } from '../types/api';
import { AudioTrack, ScriptScene } from '../types/content';

export interface AudioGeneratorConfig {
  defaultVoice: string;
  defaultSpeed: number;
  defaultPitch: number;
  defaultVolume: number;
  maxTextLength: number;
}

export interface NarrationOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  includeTimestamps?: boolean;
}

export interface AudioSyncResult {
  audioTrack: AudioTrack;
  audioResult: AudioResult;
  syncedDuration: number;
  adjustmentsMade: boolean;
}

export class AudioGenerator {
  private apiManager: GeminiAPIManager;
  private config: AudioGeneratorConfig;

  constructor(apiManager: GeminiAPIManager, config?: Partial<AudioGeneratorConfig>) {
    this.apiManager = apiManager;
    this.config = {
      defaultVoice: 'en-US-Standard-A',
      defaultSpeed: 1.0,
      defaultPitch: 0.0,
      defaultVolume: 0.8,
      maxTextLength: 5000,
      ...config
    };
  }

  /**
   * Generate audio from text (simplified interface for orchestrator)
   */
  async generateAudio(text: string, config: any): Promise<AudioResult> {
    const options: NarrationOptions = {
      voice: config.voice || this.config.defaultVoice,
      speed: config.speed || this.config.defaultSpeed,
      pitch: config.pitch || this.config.defaultPitch,
      volume: config.volume || this.config.defaultVolume
    };

    // Convert single text to dialogue array format
    const dialogue = [text];
    const result = await this.generateNarration(dialogue, options);
    return result.audioResult;
  }

  /**
   * Generate narration audio from script dialogue
   */
  async generateNarration(
    dialogue: string[],
    options: NarrationOptions = {}
  ): Promise<AudioSyncResult> {
    // Combine dialogue into a single text
    const narrationText = dialogue.join(' ');
    
    // Validate text length
    if (narrationText.length > this.config.maxTextLength) {
      throw new Error(`Narration text exceeds maximum length of ${this.config.maxTextLength} characters`);
    }

    // Prepare voice configuration
    const voiceConfig: VoiceConfig = {
      voice: options.voice || this.config.defaultVoice,
      speed: options.speed || this.config.defaultSpeed,
      pitch: options.pitch || this.config.defaultPitch,
      volume: options.volume || this.config.defaultVolume
    };

    try {
      // Generate audio using Gemini TTS
      const audioResult = await this.apiManager.generateAudio(narrationText, voiceConfig);

      // Create audio track
      const audioTrack: AudioTrack = {
        type: 'narration',
        content: narrationText,
        duration: audioResult.duration,
        volume: voiceConfig.volume
      };

      return {
        audioTrack,
        audioResult,
        syncedDuration: audioResult.duration,
        adjustmentsMade: false
      };
    } catch (error) {
      throw new Error(`Failed to generate narration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate narration for a specific scene with timing synchronization
   */
  async generateSceneNarration(
    scene: ScriptScene,
    targetDuration?: number,
    options: NarrationOptions = {}
  ): Promise<AudioSyncResult> {
    const result = await this.generateNarration(scene.dialogue, options);

    // If target duration is specified, adjust the audio to match
    if (targetDuration && Math.abs(result.audioResult.duration - targetDuration) > 0.5) {
      return this.synchronizeAudioDuration(result, targetDuration);
    }

    return result;
  }

  /**
   * Generate multiple narration tracks for scenes
   */
  async generateMultipleNarrations(
    scenes: ScriptScene[],
    options: NarrationOptions = {}
  ): Promise<AudioSyncResult[]> {
    const results: AudioSyncResult[] = [];

    for (const scene of scenes) {
      try {
        const result = await this.generateSceneNarration(scene, scene.duration, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to generate narration for scene ${scene.id}:`, error);
        // Create a silent audio track as fallback
        const fallbackTrack: AudioTrack = {
          type: 'narration',
          content: '',
          duration: scene.duration,
          volume: 0
        };
        
        const fallbackResult: AudioResult = {
          url: `silent-${scene.id}.mp3`,
          format: 'mp3',
          duration: scene.duration,
          sampleRate: 44100,
          size: 0
        };

        results.push({
          audioTrack: fallbackTrack,
          audioResult: fallbackResult,
          syncedDuration: scene.duration,
          adjustmentsMade: true
        });
      }
    }

    return results;
  }

  /**
   * Synchronize audio duration to match target duration
   */
  private synchronizeAudioDuration(
    result: AudioSyncResult,
    targetDuration: number
  ): AudioSyncResult {
    const currentDuration = result.audioResult.duration;
    const speedAdjustment = currentDuration / targetDuration;

    // Only adjust if the difference is significant and within reasonable bounds
    if (speedAdjustment >= 0.5 && speedAdjustment <= 2.0) {
      // Create adjusted audio track
      const adjustedTrack: AudioTrack = {
        ...result.audioTrack,
        duration: targetDuration
      };

      const adjustedResult: AudioResult = {
        ...result.audioResult,
        duration: targetDuration
      };

      return {
        audioTrack: adjustedTrack,
        audioResult: adjustedResult,
        syncedDuration: targetDuration,
        adjustmentsMade: true
      };
    }

    // If adjustment is not feasible, return original with warning
    console.warn(`Cannot synchronize audio duration from ${currentDuration}s to ${targetDuration}s (adjustment factor: ${speedAdjustment})`);
    return result;
  }

  /**
   * Estimate narration duration based on text length
   */
  estimateNarrationDuration(text: string, speed: number = 1.0): number {
    // Average speaking rate is about 150-160 words per minute
    // Adjust for speed setting (higher speed = faster speech = shorter duration)
    const wordsPerMinute = 155 * speed;
    const wordCount = text.split(/\s+/).length;
    return (wordCount / wordsPerMinute) * 60; // Convert to seconds
  }

  /**
   * Validate narration text for TTS compatibility
   */
  validateNarrationText(text: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check length
    if (text.length > this.config.maxTextLength) {
      issues.push(`Text exceeds maximum length of ${this.config.maxTextLength} characters`);
    }

    // Check for empty text
    if (text.trim().length === 0) {
      issues.push('Text cannot be empty');
    }

    // Check for unsupported characters (basic validation)
    const unsupportedChars = text.match(/[^\w\s.,!?;:'"()-]/g);
    if (unsupportedChars) {
      const uniqueChars = Array.from(new Set(unsupportedChars));
      issues.push(`Contains potentially unsupported characters: ${uniqueChars.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get supported voice options
   */
  getSupportedVoices(): string[] {
    return [
      'en-US-Standard-A',
      'en-US-Standard-B',
      'en-US-Standard-C',
      'en-US-Standard-D',
      'en-US-Wavenet-A',
      'en-US-Wavenet-B',
      'en-US-Wavenet-C',
      'en-US-Wavenet-D'
    ];
  }
}