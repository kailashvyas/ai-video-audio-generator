/**
 * Content Integrator Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ContentIntegrator } from '../content-integrator';
import type { 
  ContentProject, 
  IntegrationConfig,
  Scene,
  AudioTrack,
  Script,
  ScriptScene,
  ProjectMetadata,
  APIUsageStats,
  GenerationSettings
} from '../../types/content';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('ContentIntegrator', () => {
  let integrator: ContentIntegrator;
  let mockConfig: IntegrationConfig;
  let mockProject: ContentProject;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-output';
    
    mockConfig = {
      outputDirectory: tempDir,
      outputFormats: ['mp4', 'webm'],
      quality: 'standard',
      includeMetadata: true,
    };

    integrator = new ContentIntegrator(mockConfig);

    // Create mock project data
    const mockScriptScenes: ScriptScene[] = [
      {
        id: 'scene-1',
        description: 'Opening scene with character introduction',
        dialogue: ['Hello, welcome to our story'],
        characters: ['protagonist'],
        visualCues: ['wide shot of landscape'],
        duration: 15,
      },
      {
        id: 'scene-2',
        description: 'Action sequence',
        dialogue: ['The adventure begins now!'],
        characters: ['protagonist', 'sidekick'],
        visualCues: ['close-up of determined face'],
        duration: 20,
      },
    ];

    const mockScript: Script = {
      title: 'Test Adventure',
      description: 'A test adventure story',
      scenes: mockScriptScenes,
      estimatedDuration: 35,
    };

    const mockScenes: Scene[] = [
      {
        id: 'scene-1',
        scriptSceneId: 'scene-1',
        videoPrompt: 'Generate opening scene video',
        generatedVideo: '/path/to/scene1.mp4',
        status: 'completed',
      },
      {
        id: 'scene-2',
        scriptSceneId: 'scene-2',
        videoPrompt: 'Generate action sequence video',
        generatedVideo: '/path/to/scene2.mp4',
        status: 'completed',
      },
    ];

    const mockAudioTracks: AudioTrack[] = [
      {
        type: 'narration',
        content: '/path/to/narration.mp3',
        duration: 35,
        volume: 0.8,
      },
      {
        type: 'music',
        content: '/path/to/background.mp3',
        duration: 35,
        volume: 0.3,
      },
    ];

    const mockApiUsage: APIUsageStats = {
      textGeneration: 5,
      imageGeneration: 2,
      videoGeneration: 2,
      audioGeneration: 2,
      totalRequests: 11,
    };

    const mockGenerationSettings: GenerationSettings = {
      maxScenes: 5,
      budgetLimit: 100,
      useImageToVideo: false,
      outputFormats: ['mp4', 'webm'],
      quality: 'standard',
    };

    const mockMetadata: ProjectMetadata = {
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      totalCost: 25.50,
      apiUsage: mockApiUsage,
      generationSettings: mockGenerationSettings,
    };

    mockProject = {
      id: 'test-project-123',
      topic: 'Adventure Story',
      idea: 'A thrilling adventure in a magical world',
      script: mockScript,
      characters: [],
      scenes: mockScenes,
      audioTracks: mockAudioTracks,
      metadata: mockMetadata,
    };

    // Setup default mocks
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024000 } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('integrateContent', () => {
    it('should successfully integrate complete project', async () => {
      const result = await integrator.integrateContent(mockProject);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(2); // mp4 and webm
      expect(result.projectSummary.projectId).toBe('test-project-123');
      expect(result.projectSummary.sceneCount).toBe(2);
      expect(result.projectSummary.audioTrackCount).toBe(2);
      expect(result.errors).toBeUndefined();
    });

    it('should create output directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await integrator.integrateContent(mockProject);

      expect(fs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
    });

    it('should generate output files in all requested formats', async () => {
      const result = await integrator.integrateContent(mockProject);

      expect(result.outputFiles).toHaveLength(2);
      expect(result.outputFiles[0].format).toBe('mp4');
      expect(result.outputFiles[1].format).toBe('webm');
      expect(result.outputFiles[0].path).toContain('test-project-123_final.mp4');
      expect(result.outputFiles[1].path).toContain('test-project-123_final.webm');
    });

    it('should calculate correct total duration', async () => {
      const result = await integrator.integrateContent(mockProject);

      expect(result.outputFiles[0].duration).toBe(35); // 15 + 20 seconds
      expect(result.projectSummary.totalDuration).toBe(35);
    });

    it('should collect all source materials', async () => {
      const result = await integrator.integrateContent(mockProject);

      const materials = result.projectSummary.sourceMaterials;
      expect(materials).toHaveLength(5); // 2 videos + 2 audio + 1 script

      const videoMaterials = materials.filter(m => m.type === 'video');
      const audioMaterials = materials.filter(m => m.type === 'audio');
      const textMaterials = materials.filter(m => m.type === 'text');

      expect(videoMaterials).toHaveLength(2);
      expect(audioMaterials).toHaveLength(2);
      expect(textMaterials).toHaveLength(1);
    });

    it('should handle projects with no completed scenes', async () => {
      const projectWithNoScenes = {
        ...mockProject,
        scenes: [],
      };

      const result = await integrator.integrateContent(projectWithNoScenes);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Project must have at least one scene');
    });

    it('should handle projects with only pending scenes', async () => {
      const projectWithPendingScenes = {
        ...mockProject,
        scenes: [
          {
            ...mockProject.scenes[0],
            status: 'pending' as const,
            generatedVideo: undefined,
          },
        ],
      };

      const result = await integrator.integrateContent(projectWithPendingScenes);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Project must have at least one completed scene with generated video');
    });

    it('should handle file system errors gracefully', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      const result = await integrator.integrateContent(mockProject);

      // Since the integrator continues with partial success, it should succeed
      // but with no output files due to the write failures
      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(0);
    });

    it('should continue with partial success if some formats fail', async () => {
      // Mock one format to fail
      let callCount = 0;
      vi.mocked(fs.writeFile).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Format conversion failed');
        }
      });

      const result = await integrator.integrateContent(mockProject);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toHaveLength(1); // Only one format succeeded
    });
  });

  describe('concatenateVideos', () => {
    it('should create concatenation metadata file', async () => {
      const videoPaths = ['/path/to/video1.mp4', '/path/to/video2.mp4'];
      const outputPath = '/path/to/output.mp4';

      await integrator.concatenateVideos(videoPaths, outputPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('video_concatenation')
      );
    });

    it('should include all input video paths', async () => {
      const videoPaths = ['/path/to/video1.mp4', '/path/to/video2.mp4'];
      const outputPath = '/path/to/output.mp4';

      await integrator.concatenateVideos(videoPaths, outputPath);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      
      expect(content.inputs).toEqual(videoPaths);
      expect(content.output).toBe(outputPath);
    });
  });

  describe('overlayAudio', () => {
    it('should create audio overlay metadata file', async () => {
      const videoPath = '/path/to/video.mp4';
      const audioTracks = [
        {
          trackId: 'track-1',
          audioPath: '/path/to/audio1.mp3',
          startTime: 0,
          duration: 10,
          volume: 0.8,
          type: 'narration' as const,
        },
      ];
      const outputPath = '/path/to/output.mp4';

      await integrator.overlayAudio(videoPath, audioTracks, outputPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('audio_overlay')
      );
    });

    it('should include video path and audio tracks', async () => {
      const videoPath = '/path/to/video.mp4';
      const audioTracks = [
        {
          trackId: 'track-1',
          audioPath: '/path/to/audio1.mp3',
          startTime: 0,
          duration: 10,
          volume: 0.8,
          type: 'narration' as const,
        },
      ];
      const outputPath = '/path/to/output.mp4';

      await integrator.overlayAudio(videoPath, audioTracks, outputPath);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      
      expect(content.video).toBe(videoPath);
      expect(content.audioTracks).toEqual(audioTracks);
    });
  });

  describe('convertFormat', () => {
    it('should create format conversion metadata file', async () => {
      const inputPath = '/path/to/input.mp4';
      const outputPath = '/path/to/output.webm';
      const format = 'webm';

      await integrator.convertFormat(inputPath, outputPath, format);

      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('format_conversion')
      );
    });

    it('should include conversion parameters', async () => {
      const inputPath = '/path/to/input.mp4';
      const outputPath = '/path/to/output.webm';
      const format = 'webm';

      await integrator.convertFormat(inputPath, outputPath, format);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      
      expect(content.input).toBe(inputPath);
      expect(content.output).toBe(outputPath);
      expect(content.format).toBe(format);
    });
  });

  describe('video segment creation', () => {
    it('should create video segments with correct timing', async () => {
      const result = await integrator.integrateContent(mockProject);

      // Verify that timing is calculated correctly
      expect(result.success).toBe(true);
      
      // Check that the placeholder content includes timing information
      const writeCall = vi.mocked(fs.writeFile).mock.calls.find(call => 
        (call[1] as string).includes('videoSegments')
      );
      
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall![1] as string);
      
      expect(content.videoSegments).toHaveLength(2);
      expect(content.videoSegments[0].startTime).toBe(0);
      expect(content.videoSegments[0].duration).toBe(15);
      expect(content.videoSegments[1].startTime).toBe(15);
      expect(content.videoSegments[1].duration).toBe(20);
    });

    it('should associate audio tracks with video segments', async () => {
      const result = await integrator.integrateContent(mockProject);

      expect(result.success).toBe(true);
      
      const writeCall = vi.mocked(fs.writeFile).mock.calls.find(call => 
        (call[1] as string).includes('audioSegments')
      );
      
      expect(writeCall).toBeDefined();
      const content = JSON.parse(writeCall![1] as string);
      
      expect(content.audioSegments).toHaveLength(4); // 2 scenes × 2 audio tracks
      
      // Check that audio segments have correct types
      const narrationSegments = content.audioSegments.filter((s: any) => s.type === 'narration');
      const musicSegments = content.audioSegments.filter((s: any) => s.type === 'music');
      
      expect(narrationSegments).toHaveLength(2);
      expect(musicSegments).toHaveLength(2);
    });
  });

  describe('project summary generation', () => {
    it('should generate comprehensive project summary', async () => {
      const result = await integrator.integrateContent(mockProject);

      const summary = result.projectSummary;
      
      expect(summary.projectId).toBe('test-project-123');
      expect(summary.title).toBe('Test Adventure');
      expect(summary.description).toBe('A test adventure story');
      expect(summary.totalDuration).toBe(35);
      expect(summary.sceneCount).toBe(2);
      expect(summary.audioTrackCount).toBe(2);
      expect(summary.metadata).toBe(mockProject.metadata);
      expect(summary.generatedAt).toBeInstanceOf(Date);
    });

    it('should include all source materials in summary', async () => {
      const result = await integrator.integrateContent(mockProject);

      const materials = result.projectSummary.sourceMaterials;
      
      // Should have 2 videos + 2 audio tracks + 1 script
      expect(materials).toHaveLength(5);
      
      const videoMaterials = materials.filter(m => m.type === 'video');
      expect(videoMaterials).toHaveLength(2);
      expect(videoMaterials[0].path).toBe('/path/to/scene1.mp4');
      expect(videoMaterials[1].path).toBe('/path/to/scene2.mp4');
      
      const audioMaterials = materials.filter(m => m.type === 'audio');
      expect(audioMaterials).toHaveLength(2);
      expect(audioMaterials[0].type).toBe('audio');
      expect(audioMaterials[1].type).toBe('audio');
      
      const textMaterials = materials.filter(m => m.type === 'text');
      expect(textMaterials).toHaveLength(1);
      expect(textMaterials[0].name).toBe('Script');
    });
  });
});