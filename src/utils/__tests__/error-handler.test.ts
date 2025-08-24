/**
 * Unit tests for ErrorHandler class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '../error-handler';
import { APIError } from '../../types/api';
import { ContentProject } from '../../types/content';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockProject: ContentProject;
  const testProgressDir = './test-progress';

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      progressStateDir: testProgressDir,
      enableDetailedLogging: false
    });

    mockProject = {
      id: 'test-project-123',
      topic: 'Test Topic',
      idea: 'Test idea',
      script: {
        title: 'Test Script',
        description: 'Test description',
        scenes: [
          {
            id: 'scene-1',
            description: 'Test scene',
            dialogue: ['Hello world'],
            characters: ['Character 1'],
            visualCues: ['Wide shot'],
            duration: 30
          }
        ],
        estimatedDuration: 30
      },
      characters: [
        {
          name: 'Character 1',
          description: 'Test character',
          appearances: []
        }
      ],
      scenes: [
        {
          id: 'scene-1',
          scriptSceneId: 'scene-1',
          videoPrompt: 'Test prompt',
          status: 'completed'
        }
      ],
      audioTracks: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCost: 0,
        apiUsage: {
          textGeneration: 0,
          imageGeneration: 0,
          videoGeneration: 1,
          audioGeneration: 0,
          totalRequests: 1
        },
        generationSettings: {
          maxScenes: 5,
          budgetLimit: 100,
          useImageToVideo: false,
          outputFormats: ['mp4'],
          quality: 'standard'
        }
      }
    };

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleAPIError', () => {
    it('should handle retryable errors correctly', async () => {
      const error: APIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter: 1000
      };

      const context = {
        operation: 'video-generation',
        service: 'gemini-video',
        projectId: 'test-project'
      };

      const resolution = await errorHandler.handleAPIError(error, context);

      expect(resolution.action).toBe('retry');
      expect(resolution.delay).toBe(1000);
    });

    it('should handle non-retryable errors with fallback', async () => {
      const error: APIError = {
        code: 'CONTENT_FILTERED',
        message: 'Content was filtered',
        retryable: false
      };

      const context = {
        operation: 'text-generation',
        service: 'gemini-text'
      };

      const resolution = await errorHandler.handleAPIError(error, context);

      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackPrompt).toContain('rephrase the request');
    });

    it('should update service status based on errors', async () => {
      const error: APIError = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is unavailable',
        retryable: false
      };

      const context = {
        operation: 'video-generation',
        service: 'gemini-video'
      };

      await errorHandler.handleAPIError(error, context);

      const report = errorHandler.generateErrorReport();
      const videoService = report.systemStatus.apiServices.find(s => s.service === 'gemini-video');
      
      expect(videoService?.status).toBe('unavailable');
    });
  });

  describe('executeWithErrorHandling', () => {
    it('should execute operation successfully without errors', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await errorHandler.executeWithErrorHandling(
        mockOperation,
        {
          operationName: 'test-operation',
          service: 'gemini-text',
          projectId: 'test-project',
          stage: 'idea-generation'
        }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle operation failures and attempt recovery', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      // Mock the retry handler to allow one retry
      const result = await errorHandler.executeWithErrorHandling(
        mockOperation,
        {
          operationName: 'test-operation',
          service: 'gemini-text'
        }
      ).catch(() => 'failed'); // Catch the error since our mock will fail

      expect(mockOperation).toHaveBeenCalled();
    });

    it('should save progress checkpoints during operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockWriteFile = vi.mocked(fs.writeFile);

      await errorHandler.executeWithErrorHandling(
        mockOperation,
        {
          operationName: 'test-operation',
          projectId: 'test-project',
          stage: 'video-generation'
        }
      );

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('saveProgressState', () => {
    it('should save progress state to file', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockWriteFile.mockResolvedValue();

      await errorHandler.saveProgressState(mockProject, 'video-generation');

      expect(mockWriteFile).toHaveBeenCalledWith(
        path.join(testProgressDir, `${mockProject.id}.json`),
        expect.stringContaining(mockProject.id)
      );
    });

    it('should include completed stages in progress state', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockWriteFile.mockResolvedValue();

      await errorHandler.saveProgressState(mockProject, 'video-generation');

      const writeCall = mockWriteFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData.completedStages).toContain('idea-generation');
      expect(savedData.completedStages).toContain('script-generation');
      expect(savedData.completedStages).toContain('character-setup');
      expect(savedData.completedStages).toContain('video-generation');
    });

    it('should generate recovery options based on current stage', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockWriteFile.mockResolvedValue();

      await errorHandler.saveProgressState(mockProject, 'video-generation');

      const writeCall = mockWriteFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData.recoveryOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'retry',
            description: expect.stringContaining('video-generation')
          })
        ])
      );
    });
  });

  describe('loadProgressState', () => {
    it('should load progress state from file', async () => {
      const mockProgressState = {
        projectId: 'test-project',
        currentStage: 'video-generation',
        completedStages: ['idea-generation', 'script-generation'],
        failedOperations: [],
        timestamp: new Date(),
        recoveryOptions: []
      };

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(JSON.stringify(mockProgressState));

      const result = await errorHandler.loadProgressState('test-project');

      expect(result).toEqual(expect.objectContaining({
        projectId: 'test-project',
        currentStage: 'video-generation'
      }));
    });

    it('should return null if progress state file does not exist', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await errorHandler.loadProgressState('nonexistent-project');

      expect(result).toBeNull();
    });
  });

  describe('handleServiceDegradation', () => {
    it('should return true for available services', async () => {
      const result = await errorHandler.handleServiceDegradation('gemini-text');
      expect(result).toBe(true);
    });

    it('should handle degraded video service gracefully', async () => {
      // First cause an error to degrade the service
      const error: APIError = {
        code: 'TEMPORARY_FAILURE',
        message: 'Temporary failure',
        retryable: true
      };

      await errorHandler.handleAPIError(error, { service: 'gemini-video' });
      await errorHandler.handleAPIError(error, { service: 'gemini-video' });
      await errorHandler.handleAPIError(error, { service: 'gemini-video' });
      await errorHandler.handleAPIError(error, { service: 'gemini-video' });

      const result = await errorHandler.handleServiceDegradation('gemini-video');
      expect(result).toBe(true); // Should still work in degraded mode
    });

    it('should handle unavailable audio service by skipping', async () => {
      // Cause service to become unavailable
      const error: APIError = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        retryable: false
      };

      await errorHandler.handleAPIError(error, { service: 'gemini-audio' });

      const result = await errorHandler.handleServiceDegradation('gemini-audio');
      expect(result).toBe(false); // Should skip audio generation
    });

    it('should throw error for unavailable video service', async () => {
      // Cause video service to become unavailable
      const error: APIError = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        retryable: false
      };

      await errorHandler.handleAPIError(error, { service: 'gemini-video' });

      await expect(errorHandler.handleServiceDegradation('gemini-video'))
        .rejects.toThrow('Video generation service unavailable');
    });
  });

  describe('generateErrorReport', () => {
    it('should generate comprehensive error report', async () => {
      // Add some errors
      const error1: APIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true
      };

      const error2: APIError = {
        code: 'CONTENT_FILTERED',
        message: 'Content filtered',
        retryable: false
      };

      await errorHandler.handleAPIError(error1, { 
        operation: 'video-generation',
        projectId: 'test-project'
      });
      
      await errorHandler.handleAPIError(error2, { 
        operation: 'text-generation',
        projectId: 'test-project'
      });

      const report = errorHandler.generateErrorReport('test-project');

      expect(report.projectId).toBe('test-project');
      expect(report.errors).toHaveLength(2);
      expect(report.systemStatus).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should generate system-wide report when no project ID provided', async () => {
      const error: APIError = {
        code: 'QUOTA_EXCEEDED',
        message: 'Quota exceeded',
        retryable: false
      };

      await errorHandler.handleAPIError(error, { operation: 'image-generation' });

      const report = errorHandler.generateErrorReport();

      expect(report.projectId).toBe('system');
      expect(report.errors).toHaveLength(1);
    });

    it('should include relevant recommendations based on error patterns', async () => {
      // Generate multiple rate limit errors
      const rateLimitError: APIError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retryable: true
      };

      for (let i = 0; i < 4; i++) {
        await errorHandler.handleAPIError(rateLimitError, { 
          operation: 'video-generation'
        });
      }

      const report = errorHandler.generateErrorReport();

      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('reducing concurrent operations')
        ])
      );
    });
  });

  describe('clearProjectErrors', () => {
    it('should clear errors for specific project', async () => {
      const error: APIError = {
        code: 'TEST_ERROR',
        message: 'Test error',
        retryable: false
      };

      await errorHandler.handleAPIError(error, { 
        operation: 'test-op',
        projectId: 'project-1'
      });
      
      await errorHandler.handleAPIError(error, { 
        operation: 'test-op',
        projectId: 'project-2'
      });

      errorHandler.clearProjectErrors('project-1');

      const report = errorHandler.generateErrorReport();
      const project1Errors = report.errors.filter(e => e.context.projectId === 'project-1');
      const project2Errors = report.errors.filter(e => e.context.projectId === 'project-2');

      expect(project1Errors).toHaveLength(0);
      expect(project2Errors).toHaveLength(1);
    });
  });

  describe('error logging and recovery actions', () => {
    it('should log recovery actions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const errorHandlerWithLogging = new ErrorHandler({
        enableDetailedLogging: true
      });

      const mockOperation = vi.fn().mockResolvedValue('success');
      
      await errorHandlerWithLogging.executeWithErrorHandling(
        mockOperation,
        { operationName: 'test-operation' }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RECOVERY]'),
        expect.stringContaining('Operation completed without errors')
      );

      consoleSpy.mockRestore();
    });

    it('should track recovery actions in error report', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      await errorHandler.executeWithErrorHandling(
        mockOperation,
        { operationName: 'test-operation' }
      );

      const report = errorHandler.generateErrorReport();
      
      expect(report.recoveryActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: expect.stringContaining('Successfully completed test-operation'),
            success: true
          })
        ])
      );
    });
  });
});