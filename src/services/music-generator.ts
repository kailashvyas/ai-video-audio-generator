/**
 * Music Generator service for background music using MusicLM
 */

import { GeminiAPIManager } from '../api/gemini-api-manager';
import { AudioResult } from '../types/api';
import { AudioTrack } from '../types/content';

export interface MusicGeneratorConfig {
  defaultGenre: string;
  defaultTempo: number;
  defaultInstruments: string[];
  maxDuration: number;
  defaultVolume: number;
}

export interface MusicOptions {
  genre?: string;
  mood?: string;
  tempo?: number;
  instruments?: string[];
  duration?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface MusicGenerationResult {
  audioTrack: AudioTrack;
  audioResult: AudioResult;
  prompt: string;
  metadata: MusicMetadata;
}

export interface MusicMetadata {
  genre: string;
  mood: string;
  tempo: number;
  instruments: string[];
  key?: string;
  timeSignature?: string;
}

export class MusicGenerator {
  private apiManager: GeminiAPIManager;
  private config: MusicGeneratorConfig;

  constructor(apiManager: GeminiAPIManager, config?: Partial<MusicGeneratorConfig>) {
    this.apiManager = apiManager;
    this.config = {
      defaultGenre: 'ambient',
      defaultTempo: 120,
      defaultInstruments: ['piano', 'strings'],
      maxDuration: 300, // 5 minutes
      defaultVolume: 0.3,
      ...config
    };
  }

  /**
   * Generate background music based on content mood and requirements
   */
  async generateBackgroundMusic(
    contentDescription: string,
    options: MusicOptions = {}
  ): Promise<MusicGenerationResult> {
    // Analyze content to determine appropriate music style
    const musicStyle = this.analyzeContentForMusicStyle(contentDescription);
    
    // Merge with user options
    const finalOptions: Required<MusicOptions> = {
      genre: options.genre || musicStyle.genre,
      mood: options.mood || musicStyle.mood,
      tempo: options.tempo || musicStyle.tempo,
      instruments: options.instruments || musicStyle.instruments,
      duration: options.duration || 60, // Default 1 minute
      volume: options.volume || this.config.defaultVolume,
      fadeIn: options.fadeIn || 2,
      fadeOut: options.fadeOut || 3
    };

    // Validate duration
    if (finalOptions.duration > this.config.maxDuration) {
      throw new Error(`Music duration exceeds maximum of ${this.config.maxDuration} seconds`);
    }

    // Generate music prompt for MusicLM
    const musicPrompt = this.createMusicPrompt(finalOptions);

    try {
      // Generate music using Gemini API (MusicLM integration)
      const audioResult = await this.generateMusicWithMusicLM(musicPrompt, finalOptions.duration);

      // Create audio track
      const audioTrack: AudioTrack = {
        type: 'music',
        content: musicPrompt,
        duration: audioResult.duration,
        volume: finalOptions.volume
      };

      // Create metadata
      const metadata: MusicMetadata = {
        genre: finalOptions.genre,
        mood: finalOptions.mood,
        tempo: finalOptions.tempo,
        instruments: finalOptions.instruments
      };

      return {
        audioTrack,
        audioResult,
        prompt: musicPrompt,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate background music: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate music for multiple scenes with consistent style
   */
  async generateSceneMusic(
    scenes: Array<{ id: string; description: string; duration: number; mood?: string }>,
    baseOptions: MusicOptions = {}
  ): Promise<MusicGenerationResult[]> {
    const results: MusicGenerationResult[] = [];

    for (const scene of scenes) {
      try {
        const sceneOptions: MusicOptions = {
          ...baseOptions,
          duration: scene.duration,
          mood: scene.mood || baseOptions.mood
        };

        const result = await this.generateBackgroundMusic(scene.description, sceneOptions);
        results.push(result);
      } catch (error) {
        console.error(`Failed to generate music for scene ${scene.id}:`, error);
        
        // Create silent music track as fallback
        const fallbackTrack: AudioTrack = {
          type: 'music',
          content: '',
          duration: scene.duration,
          volume: 0
        };
        
        const fallbackResult: AudioResult = {
          url: `silent-music-${scene.id}.mp3`,
          format: 'mp3',
          duration: scene.duration,
          sampleRate: 44100,
          size: 0
        };

        const fallbackMetadata: MusicMetadata = {
          genre: 'silence',
          mood: 'neutral',
          tempo: 0,
          instruments: []
        };

        results.push({
          audioTrack: fallbackTrack,
          audioResult: fallbackResult,
          prompt: '',
          metadata: fallbackMetadata
        });
      }
    }

    return results;
  }

  /**
   * Generate music using MusicLM through Gemini API
   */
  private async generateMusicWithMusicLM(prompt: string, duration: number): Promise<AudioResult> {
    // In a real implementation, this would use the actual MusicLM API
    // For now, we'll simulate the call through the Gemini API manager
    
    // Create a music generation prompt for the API
    const musicPrompt = `Generate instrumental music: ${prompt}. Duration: ${duration} seconds.`;
    
    // Use the audio generation capability (placeholder for MusicLM)
    const voiceConfig = {
      voice: 'music-generation',
      speed: 1.0,
      pitch: 0.0,
      volume: 0.3
    };

    const audioResult = await this.apiManager.generateAudio(musicPrompt, voiceConfig);
    
    // Adjust the result to match the requested duration
    return {
      ...audioResult,
      duration: duration,
      url: `generated-music-${Date.now()}.mp3`
    };
  }

  /**
   * Analyze content description to determine appropriate music style
   */
  private analyzeContentForMusicStyle(contentDescription: string): Required<Omit<MusicOptions, 'duration' | 'volume' | 'fadeIn' | 'fadeOut'>> {
    const description = contentDescription.toLowerCase();
    
    // Determine mood based on content keywords
    let mood = 'neutral';
    if (description.includes('exciting') || description.includes('action') || description.includes('adventure')) {
      mood = 'energetic';
    } else if (description.includes('sad') || description.includes('emotional') || description.includes('dramatic')) {
      mood = 'melancholic';
    } else if (description.includes('happy') || description.includes('joyful') || description.includes('celebration')) {
      mood = 'upbeat';
    } else if (description.includes('mysterious') || description.includes('suspense') || description.includes('dark')) {
      mood = 'mysterious';
    } else if (description.includes('peaceful') || description.includes('calm') || description.includes('relaxing')) {
      mood = 'peaceful';
    }

    // Determine genre based on content type
    let genre = this.config.defaultGenre;
    if (description.includes('documentary') || description.includes('educational')) {
      genre = 'ambient';
    } else if (description.includes('commercial') || description.includes('advertisement')) {
      genre = 'corporate';
    } else if (description.includes('game') || description.includes('gaming')) {
      genre = 'electronic';
    } else if (description.includes('nature') || description.includes('travel')) {
      genre = 'cinematic';
    }

    // Determine tempo based on mood
    let tempo = this.config.defaultTempo;
    switch (mood) {
      case 'energetic':
        tempo = 140;
        break;
      case 'upbeat':
        tempo = 130;
        break;
      case 'peaceful':
        tempo = 80;
        break;
      case 'melancholic':
        tempo = 70;
        break;
      case 'mysterious':
        tempo = 90;
        break;
    }

    // Determine instruments based on genre and mood
    let instruments = [...this.config.defaultInstruments];
    if (genre === 'electronic') {
      instruments = ['synthesizer', 'electronic drums', 'bass'];
    } else if (genre === 'cinematic') {
      instruments = ['orchestra', 'strings', 'brass', 'percussion'];
    } else if (genre === 'corporate') {
      instruments = ['piano', 'guitar', 'light percussion'];
    } else if (mood === 'peaceful') {
      instruments = ['piano', 'soft strings', 'flute'];
    } else if (mood === 'energetic') {
      instruments = ['drums', 'electric guitar', 'bass'];
    }

    return {
      genre,
      mood,
      tempo,
      instruments
    };
  }

  /**
   * Create a detailed music prompt for MusicLM
   */
  private createMusicPrompt(options: Required<MusicOptions>): string {
    const parts = [
      `${options.genre} music`,
      `${options.mood} mood`,
      `${options.tempo} BPM`,
      `featuring ${options.instruments.join(', ')}`
    ];

    // Add additional descriptors based on genre and mood
    if (options.genre === 'cinematic') {
      parts.push('orchestral arrangement');
    }
    
    if (options.mood === 'peaceful') {
      parts.push('soft dynamics', 'gentle melodies');
    } else if (options.mood === 'energetic') {
      parts.push('driving rhythm', 'dynamic build-ups');
    } else if (options.mood === 'mysterious') {
      parts.push('minor key', 'atmospheric textures');
    }

    // Add fade instructions
    if (options.fadeIn > 0) {
      parts.push(`${options.fadeIn} second fade in`);
    }
    if (options.fadeOut > 0) {
      parts.push(`${options.fadeOut} second fade out`);
    }

    return parts.join(', ');
  }

  /**
   * Get supported music genres
   */
  getSupportedGenres(): string[] {
    return [
      'ambient',
      'cinematic',
      'corporate',
      'electronic',
      'jazz',
      'classical',
      'folk',
      'rock',
      'pop',
      'world'
    ];
  }

  /**
   * Get supported moods
   */
  getSupportedMoods(): string[] {
    return [
      'peaceful',
      'energetic',
      'upbeat',
      'melancholic',
      'mysterious',
      'dramatic',
      'neutral',
      'inspiring',
      'romantic',
      'suspenseful'
    ];
  }

  /**
   * Estimate music generation cost
   */
  estimateGenerationCost(duration: number): number {
    // Base cost per minute of music generation
    const costPerMinute = 0.05; // $0.05 per minute
    const minutes = duration / 60;
    return Math.max(0.01, minutes * costPerMinute); // Minimum $0.01
  }
}