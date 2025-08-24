/**
 * Unit tests for MusicGenerator service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MusicGenerator, MusicGeneratorConfig, MusicOptions } from '../music-generator';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { AudioResult } from '../../types/api';

// Mock the GeminiAPIManager
vi.mock('../../api/gemini-api-manager');

describe('MusicGenerator', () => {
  let musicGenerator: MusicGenerator;
  let mockApiManager: vi.Mocked<GeminiAPIManager>;
  let config: MusicGeneratorConfig;

  beforeEach(() => {
    // Create mock API manager
    mockApiManager = {
      generateAudio: vi.fn(),
      generateText: vi.fn(),
      generateImage: vi.fn(),
      generateVideo: vi.fn(),
      estimateCost: vi.fn(),
      getUsageStats: vi.fn(),
      resetUsageStats: vi.fn()
    } as any;

    // Default configuration
    config = {
      defaultGenre: 'ambient',
      defaultTempo: 120,
      defaultInstruments: ['piano', 'strings'],
      maxDuration: 300,
      defaultVolume: 0.3
    };

    musicGenerator = new MusicGenerator(mockApiManager, config);
  });

  describe('generateBackgroundMusic', () => {
    it('should generate background music with default options', async () => {
      // Arrange
      const contentDescription = 'A peaceful nature documentary about forests';
      const mockAudioResult: AudioResult = {
        url: 'generated-music.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(mockApiManager.generateAudio).toHaveBeenCalledWith(
        expect.stringContaining('Generate instrumental music'),
        expect.objectContaining({
          voice: 'music-generation',
          volume: config.defaultVolume
        })
      );

      expect(result.audioTrack).toEqual({
        type: 'music',
        content: expect.any(String),
        duration: 60,
        volume: config.defaultVolume
      });

      expect(result.metadata.genre).toBe('ambient'); // Should detect nature content
      expect(result.metadata.mood).toBe('peaceful'); // Should detect peaceful mood
    });

    it('should use custom music options', async () => {
      // Arrange
      const contentDescription = 'Action-packed adventure scene';
      const options: MusicOptions = {
        genre: 'electronic',
        mood: 'energetic',
        tempo: 140,
        instruments: ['synthesizer', 'drums'],
        duration: 30,
        volume: 0.5
      };

      const mockAudioResult: AudioResult = {
        url: 'custom-music.mp3',
        format: 'mp3',
        duration: 30,
        sampleRate: 44100,
        size: 960000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription, options);

      // Assert
      expect(result.metadata.genre).toBe('electronic');
      expect(result.metadata.mood).toBe('energetic');
      expect(result.metadata.tempo).toBe(140);
      expect(result.metadata.instruments).toEqual(['synthesizer', 'drums']);
      expect(result.audioTrack.duration).toBe(30);
      expect(result.audioTrack.volume).toBe(0.5);
    });

    it('should throw error for duration exceeding maximum', async () => {
      // Arrange
      const contentDescription = 'Test content';
      const options: MusicOptions = {
        duration: config.maxDuration + 1
      };

      // Act & Assert
      await expect(
        musicGenerator.generateBackgroundMusic(contentDescription, options)
      ).rejects.toThrow(`Music duration exceeds maximum of ${config.maxDuration} seconds`);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const contentDescription = 'Test content';
      mockApiManager.generateAudio.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(
        musicGenerator.generateBackgroundMusic(contentDescription)
      ).rejects.toThrow('Failed to generate background music: API Error');
    });
  });

  describe('generateSceneMusic', () => {
    it('should generate music for multiple scenes', async () => {
      // Arrange
      const scenes = [
        {
          id: 'scene-1',
          description: 'Peaceful forest scene',
          duration: 30,
          mood: 'peaceful'
        },
        {
          id: 'scene-2',
          description: 'Exciting chase scene',
          duration: 45,
          mood: 'energetic'
        }
      ];

      const mockAudioResults: AudioResult[] = [
        {
          url: 'music-1.mp3',
          format: 'mp3',
          duration: 30,
          sampleRate: 44100,
          size: 960000
        },
        {
          url: 'music-2.mp3',
          format: 'mp3',
          duration: 45,
          sampleRate: 44100,
          size: 1440000
        }
      ];

      mockApiManager.generateAudio
        .mockResolvedValueOnce(mockAudioResults[0])
        .mockResolvedValueOnce(mockAudioResults[1]);

      // Act
      const results = await musicGenerator.generateSceneMusic(scenes);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].audioTrack.duration).toBe(30);
      expect(results[1].audioTrack.duration).toBe(45);
      expect(results[0].metadata.mood).toBe('peaceful');
      expect(results[1].metadata.mood).toBe('energetic');
      expect(mockApiManager.generateAudio).toHaveBeenCalledTimes(2);
    });

    it('should create fallback silent tracks for failed generations', async () => {
      // Arrange
      const scenes = [
        {
          id: 'scene-1',
          description: 'Test scene',
          duration: 30
        }
      ];

      mockApiManager.generateAudio.mockRejectedValue(new Error('API Error'));

      // Act
      const results = await musicGenerator.generateSceneMusic(scenes);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].audioTrack.content).toBe('');
      expect(results[0].audioTrack.volume).toBe(0);
      expect(results[0].metadata.genre).toBe('silence');
    });
  });

  describe('content analysis', () => {
    it('should detect documentary content and set ambient genre', async () => {
      // Arrange
      const contentDescription = 'Educational documentary about marine life';
      const mockAudioResult: AudioResult = {
        url: 'test.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(result.metadata.genre).toBe('ambient');
    });

    it('should detect commercial content and set corporate genre', async () => {
      // Arrange
      const contentDescription = 'Commercial advertisement for new product';
      const mockAudioResult: AudioResult = {
        url: 'test.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(result.metadata.genre).toBe('corporate');
    });

    it('should detect gaming content and set electronic genre', async () => {
      // Arrange
      const contentDescription = 'Gaming video with action sequences';
      const mockAudioResult: AudioResult = {
        url: 'test.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(result.metadata.genre).toBe('electronic');
    });

    it('should detect energetic mood and adjust tempo', async () => {
      // Arrange
      const contentDescription = 'Exciting action adventure with thrills';
      const mockAudioResult: AudioResult = {
        url: 'test.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(result.metadata.mood).toBe('energetic');
      expect(result.metadata.tempo).toBe(140); // Higher tempo for energetic mood
    });

    it('should detect peaceful mood and adjust tempo', async () => {
      // Arrange
      const contentDescription = 'Calm and peaceful meditation session';
      const mockAudioResult: AudioResult = {
        url: 'test.mp3',
        format: 'mp3',
        duration: 60,
        sampleRate: 44100,
        size: 1920000
      };

      mockApiManager.generateAudio.mockResolvedValue(mockAudioResult);

      // Act
      const result = await musicGenerator.generateBackgroundMusic(contentDescription);

      // Assert
      expect(result.metadata.mood).toBe('peaceful');
      expect(result.metadata.tempo).toBe(80); // Lower tempo for peaceful mood
    });
  });

  describe('getSupportedGenres', () => {
    it('should return list of supported genres', () => {
      // Act
      const genres = musicGenerator.getSupportedGenres();

      // Assert
      expect(genres).toBeInstanceOf(Array);
      expect(genres.length).toBeGreaterThan(0);
      expect(genres).toContain('ambient');
      expect(genres).toContain('cinematic');
      expect(genres).toContain('electronic');
    });
  });

  describe('getSupportedMoods', () => {
    it('should return list of supported moods', () => {
      // Act
      const moods = musicGenerator.getSupportedMoods();

      // Assert
      expect(moods).toBeInstanceOf(Array);
      expect(moods.length).toBeGreaterThan(0);
      expect(moods).toContain('peaceful');
      expect(moods).toContain('energetic');
      expect(moods).toContain('mysterious');
    });
  });

  describe('estimateGenerationCost', () => {
    it('should estimate cost based on duration', () => {
      // Act
      const cost60s = musicGenerator.estimateGenerationCost(60);
      const cost120s = musicGenerator.estimateGenerationCost(120);

      // Assert
      expect(cost60s).toBeGreaterThan(0);
      expect(cost120s).toBeGreaterThan(cost60s);
      expect(cost120s).toBeCloseTo(cost60s * 2, 2);
    });

    it('should have minimum cost', () => {
      // Act
      const cost = musicGenerator.estimateGenerationCost(1); // Very short duration

      // Assert
      expect(cost).toBeGreaterThanOrEqual(0.01); // Minimum $0.01
    });
  });
});