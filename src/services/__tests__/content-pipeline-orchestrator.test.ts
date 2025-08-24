/**
 * Integration tests for Content Pipeline Orchestrator
 * Tests complete pipeline coordination, pause/resume, progress tracking, and configuration handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentPipelineOrchestrator, OrchestrationConfig } from '../content-pipeline-orchestrator';
import { CostMonitor, CostMonitorConfig } from '../cost-monitor';
import { CharacterDatabaseManager } from '../../managers/character-database-manager';
import { GeminiAPIManager } from '../../api/gemini-api-manager';
import { ContentConfig, GenerationStage } from '../../types';

// Mock dependencies
vi.mock('../../api/gemini-api-manager');
vi.mock('../cost-monitor');
vi.mock('../../managers/character-database-manager');

describe('ContentPipelineOrchestrator', () => {
  let orchestrator: ContentPipelineOrchestrator;
  let mockCostMonitor: CostMonitor;
  let mockCharacterManager: CharacterDatabaseManager;
  let mockApiManager: GeminiAPIManager;
  let validConfig: OrchestrationConfig;

  beforeEach(() => {
    // Create mock instances
    mockCostMonitor = new CostMonitor({
      budgetLimit: 100,
      warningThreshold: 0.8,
      trackingPeriod: 'session'
    } as CostMonitorConfig);

    mockCharacterManager = new CharacterDatabaseManager();
    mockApiManager = new GeminiAPIManager('test-key');

    // Mock the methods we need
    vi.mocked(mockCostMonitor.getCurrentUsage).mockReturnValue({
      totalCost: 10,
      requestCount: 5,
      tokensUsed: 1000,
      quotaRemaining: 90
    });

    vi.mocked(mockCharacterManager.initializeProject).mockImplementation(() => {});

    // Create orchestrator instance
    orchestrator = new ContentPipelineOrchestrator(
      mockCostMonitor,
      mockCharacterManager,
      mockApiManager
    );

    // Valid configuration for testing
    validConfig = {
      topic: 'Test Content',
      maxScenes: 5,
      budgetLimit: 100,
      useImageToVideo: false,
      outputFormats: ['mp4'],
      quality: 'standard',
      enableAutoSave: false,
      maxRetries: 3
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', async () => {
      await expect(orchestrator.generateContent(validConfig)).resolves.toBeDefined();
    });

    it('should reject configuration with invalid maxScenes', async () => {
      const invalidConfig = { ...validConfig, maxScenes: 0 };
      await expect(orchestrator.generateContent(invalidConfig)).rejects.toThrow('maxScenes must be greater than 0');
    });

    it('should reject configuration with invalid budgetLimit', async () => {
      const invalidConfig = { ...validConfig, budgetLimit: -10 };
      await expect(orchestrator.generateContent(invalidConfig)).rejects.toThrow('budgetLimit must be greater than 0');
    });

    it('should reject configuration with empty output formats', async () => {
      const invalidConfig = { ...validConfig, outputFormats: [] };
      await expect(orchestrator.generateContent(invalidConfig)).rejects.toThrow('At least one output format must be specified');
    });

    it('should reject configuration with invalid output formats', async () => {
      const invalidConfig = { ...validConfig, outputFormats: ['invalid'] };
      await expect(orchestrator.generateContent(invalidConfig)).rejects.toThrow('Invalid output formats: invalid');
    });
  });

  describe('Pipeline Initialization', () => {
    it('should initialize project and state correctly', async () => {
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.project).toBeDefined();
      expect(result.project.id).toBeDefined();
      expect(result.project.topic).toBe('Test Content');
      expect(result.project.metadata.generationSettings.maxScenes).toBe(5);
      expect(mockCharacterManager.initializeProject).toHaveBeenCalledWith(result.project.id);
    });

    it('should emit initialization event', async () => {
      const initSpy = vi.fn();
      orchestrator.on('initialized', initSpy);
      
      await orchestrator.generateContent(validConfig);
      
      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: expect.any(String),
          config: validConfig
        })
      );
    });
  });

  describe('Pipeline Execution', () => {
    it('should execute all pipeline stages in order', async () => {
      const stageStartedSpy = vi.fn();
      const stageCompletedSpy = vi.fn();
      
      orchestrator.on('stageStarted', stageStartedSpy);
      orchestrator.on('stageCompleted', stageCompletedSpy);
      
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.success).toBe(true);
      expect(stageStartedSpy).toHaveBeenCalledTimes(8); // 8 stages
      expect(stageCompletedSpy).toHaveBeenCalledTimes(8);
      
      // Verify stages were called in correct order
      const expectedStages: GenerationStage[] = [
        'idea_generation',
        'script_creation',
        'character_analysis',
        'image_generation',
        'video_generation',
        'audio_generation',
        'content_integration',
        'finalization'
      ];
      
      expectedStages.forEach((stage, index) => {
        expect(stageStartedSpy).toHaveBeenNthCalledWith(index + 1, 
          expect.objectContaining({ stage })
        );
        expect(stageCompletedSpy).toHaveBeenNthCalledWith(index + 1,
          expect.objectContaining({ stage })
        );
      });
    });

    it('should track progress correctly throughout pipeline', async () => {
      const progressUpdates: any[] = [];
      
      orchestrator.on('stageCompleted', (data) => {
        progressUpdates.push(data.progress);
      });
      
      await orchestrator.generateContent(validConfig);
      
      expect(progressUpdates).toHaveLength(8);
      
      // Progress should increase with each stage
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].overallProgress).toBeGreaterThan(
          progressUpdates[i - 1].overallProgress
        );
      }
    });

    it('should handle stage execution errors gracefully', async () => {
      // Mock a stage to throw an error
      const originalExecuteStage = (orchestrator as any).executeStage;
      (orchestrator as any).executeStage = vi.fn().mockImplementation(async (stage: GenerationStage) => {
        if (stage === 'video_generation') {
          throw new Error('Video generation failed');
        }
        return originalExecuteStage.call(orchestrator, stage);
      });
      
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Video generation failed');
    });
  });

  describe('Pause and Resume Functionality', () => {
    it('should support pause and resume state management', async () => {
      // Test pause/resume state management without actual generation
      await orchestrator.generateContent({ ...validConfig, enableAutoSave: false });
      
      // Start a new generation to test pause/resume
      const generationPromise = orchestrator.generateContent(validConfig);
      
      // Wait a moment for generation to start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Test pause functionality
      orchestrator.pauseGeneration();
      expect(orchestrator.isPaused()).toBe(true);
      expect(orchestrator.isRunning()).toBe(true);
      
      // Test resume functionality
      orchestrator.resumeGeneration();
      expect(orchestrator.isPaused()).toBe(false);
      expect(orchestrator.isRunning()).toBe(true);
      
      // Complete the generation
      await generationPromise;
    });

    it('should emit pause and resume events correctly', async () => {
      const pausedSpy = vi.fn();
      const resumedSpy = vi.fn();
      
      orchestrator.on('paused', pausedSpy);
      orchestrator.on('resumed', resumedSpy);
      
      // Start generation
      const generationPromise = orchestrator.generateContent(validConfig);
      
      // Wait for generation to start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Pause
      orchestrator.pauseGeneration();
      expect(pausedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: expect.any(String),
          currentStage: expect.any(String),
          pausedAt: expect.any(Date)
        })
      );
      
      // Resume
      orchestrator.resumeGeneration();
      expect(resumedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: expect.any(String),
          currentStage: expect.any(String),
          resumedAt: expect.any(Date)
        })
      );
      
      // Complete generation
      await generationPromise;
    });

    it('should throw error when pausing non-running generation', () => {
      expect(() => orchestrator.pauseGeneration()).toThrow('No active generation to pause');
    });

    it('should throw error when resuming non-paused generation', () => {
      expect(() => orchestrator.resumeGeneration()).toThrow('No paused generation to resume');
    });
  });

  describe('Progress Tracking', () => {
    it('should provide accurate progress information', async () => {
      let progressData: any;
      
      orchestrator.on('stageStarted', (data) => {
        if (data.stage === 'character_analysis') {
          // Get progress when character_analysis stage starts (after script_creation completes)
          progressData = orchestrator.getProgress();
        }
      });
      
      await orchestrator.generateContent(validConfig);
      
      expect(progressData).toBeDefined();
      expect(progressData.currentStage).toBe('character_analysis');
      expect(progressData.completedStages).toContain('idea_generation');
      expect(progressData.completedStages).toContain('script_creation');
      expect(progressData.totalStages).toBe(8);
      expect(progressData.overallProgress).toBeGreaterThan(0);
      expect(progressData.overallProgress).toBeLessThan(1);
    });

    it('should throw error when getting progress without active generation', () => {
      expect(() => orchestrator.getProgress()).toThrow('No active generation');
    });

    it('should calculate estimated remaining time', async () => {
      let progressData: any;
      
      orchestrator.on('stageCompleted', (data) => {
        if (data.stage === 'character_analysis') {
          progressData = orchestrator.getProgress();
        }
      });
      
      await orchestrator.generateContent(validConfig);
      
      expect(progressData.estimatedTimeRemaining).toBeDefined();
      expect(typeof progressData.estimatedTimeRemaining).toBe('number');
      expect(progressData.estimatedTimeRemaining).toBeGreaterThan(0);
    });
  });

  describe('Budget Monitoring', () => {
    it('should emit budget warnings when approaching limit', async () => {
      // Mock high cost usage
      vi.mocked(mockCostMonitor.getCurrentUsage).mockReturnValue({
        totalCost: 85, // 85% of 100 budget limit
        requestCount: 20,
        tokensUsed: 5000,
        quotaRemaining: 15
      });
      
      const budgetWarningSpy = vi.fn();
      orchestrator.on('budgetWarning', budgetWarningSpy);
      
      await orchestrator.generateContent(validConfig);
      
      expect(budgetWarningSpy).toHaveBeenCalled();
      expect(budgetWarningSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          currentCost: 85,
          budgetLimit: 100,
          usagePercent: 85
        })
      );
    });

    it('should not emit budget warnings when usage is low', async () => {
      // Mock low cost usage
      vi.mocked(mockCostMonitor.getCurrentUsage).mockReturnValue({
        totalCost: 30, // 30% of budget limit
        requestCount: 5,
        tokensUsed: 1000,
        quotaRemaining: 70
      });
      
      const budgetWarningSpy = vi.fn();
      orchestrator.on('budgetWarning', budgetWarningSpy);
      
      await orchestrator.generateContent(validConfig);
      
      expect(budgetWarningSpy).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save Progress Tracking', () => {
    it('should save progress at specified intervals when enabled', async () => {
      const progressSavedSpy = vi.fn();
      orchestrator.on('progressSaved', progressSavedSpy);
      
      const configWithAutoSave = {
        ...validConfig,
        enableAutoSave: true,
        saveProgressInterval: 50 // 50ms for testing
      };
      
      await orchestrator.generateContent(configWithAutoSave);
      
      // Should have saved progress at least once during generation
      expect(progressSavedSpy).toHaveBeenCalled();
      expect(progressSavedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: expect.any(String),
          progress: expect.any(Object),
          timestamp: expect.any(Date)
        })
      );
    });

    it('should not save progress when auto-save is disabled', async () => {
      const progressSavedSpy = vi.fn();
      orchestrator.on('progressSaved', progressSavedSpy);
      
      await orchestrator.generateContent(validConfig); // enableAutoSave is false
      
      expect(progressSavedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors and include them in result', async () => {
      // Test error handling by mocking the simulateStageWork method to throw an error
      const originalSimulateStageWork = (orchestrator as any).simulateStageWork;
      let errorThrown = false;
      
      (orchestrator as any).simulateStageWork = vi.fn().mockImplementation(async (stage: GenerationStage) => {
        if (stage === 'audio_generation' && !errorThrown) {
          errorThrown = true;
          throw new Error('Audio service unavailable');
        }
        return originalSimulateStageWork.call(orchestrator, stage);
      });
      
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Audio service unavailable');
      
      // Restore original method
      (orchestrator as any).simulateStageWork = originalSimulateStageWork;
    });

    it('should cleanup resources after completion', async () => {
      const cleanupSpy = vi.fn();
      orchestrator.on('cleanup', cleanupSpy);
      
      await orchestrator.generateContent(validConfig);
      
      expect(cleanupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: expect.any(String),
          completedAt: expect.any(Date)
        })
      );
      
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe('Result Generation', () => {
    it('should generate comprehensive result on successful completion', async () => {
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalDuration).toBeGreaterThan(0);
      expect(result.summary.scenesGenerated).toBe(0); // No actual scenes in mock
      expect(result.summary.charactersCreated).toBe(0); // No actual characters in mock
    });

    it('should include errors and warnings in result', async () => {
      // Mock an error and warning scenario
      vi.mocked(mockCostMonitor.getCurrentUsage).mockReturnValue({
        totalCost: 85, // Will trigger warning
        requestCount: 20,
        tokensUsed: 5000,
        quotaRemaining: 15
      });
      
      const originalExecuteStage = (orchestrator as any).executeStage;
      (orchestrator as any).executeStage = vi.fn().mockImplementation(async (stage: GenerationStage) => {
        if (stage === 'finalization') {
          throw new Error('Finalization error');
        }
        return originalExecuteStage.call(orchestrator, stage);
      });
      
      const result = await orchestrator.generateContent(validConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Finalization error');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Budget limit approaching'))).toBe(true);
    });
  });
});