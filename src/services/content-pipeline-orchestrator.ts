/**
 * Content Pipeline Orchestrator - Main workflow controller for AI content generation
 * 
 * This class coordinates the entire content generation pipeline, managing:
 * - Workflow orchestration across all generation stages
 * - Pause/resume functionality for long-running operations
 * - Progress tracking and status reporting
 * - Configuration handling and validation
 * - Error handling and recovery
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  ContentConfig, 
  ContentResult, 
  GenerationProgress, 
  GenerationStage,
  ContentProject,
  GenerationSummary,
  EnvironmentConfig
} from '../types';
import { CostMonitor } from './cost-monitor';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
// Note: GeminiAPIManager will be used in future implementations
// import { GeminiAPIManager } from '../api/gemini-api-manager';

export interface SystemStatus {
  geminiConnected: boolean;
  musicLmConnected: boolean;
  usage: {
    textGeneration: number;
    imageGeneration: number;
    videoGeneration: number;
    audioGeneration: number;
    totalCost: number;
  };
  config: {
    outputDirectory: string;
    maxConcurrentRequests: number;
    defaultBudgetLimit: number;
  };
}

export interface PipelineState {
  projectId: string;
  currentStage: GenerationStage;
  isPaused: boolean;
  isRunning: boolean;
  startTime: Date;
  pausedTime?: Date;
  resumedTime?: Date;
  stageStartTime: Date;
  completedStages: GenerationStage[];
  errors: string[];
  warnings: string[];
}

export interface OrchestrationConfig extends ContentConfig {
  saveProgressInterval?: number; // milliseconds
  enableAutoSave?: boolean;
  maxRetries?: number;
}

export class ContentPipelineOrchestrator extends EventEmitter {
  private state: PipelineState | null = null;
  private project: ContentProject | null = null;
  private config: OrchestrationConfig | null = null;
  private costMonitor: CostMonitor;
  private characterManager: CharacterDatabaseManager;
  // Note: API manager will be used in future stage implementations
  // private apiManager: GeminiAPIManager;
  private progressSaveInterval?: NodeJS.Timeout;
  private progressCallback?: (progress: GenerationProgress) => void;

  // Define the complete pipeline stages in order
  private readonly PIPELINE_STAGES: GenerationStage[] = [
    'idea_generation',
    'script_creation', 
    'character_analysis',
    'image_generation',
    'video_generation',
    'audio_generation',
    'content_integration',
    'finalization'
  ];

  constructor(
    private envConfig: EnvironmentConfig,
    costMonitor?: CostMonitor,
    characterManager?: CharacterDatabaseManager
  ) {
    super();
    this.costMonitor = costMonitor || new CostMonitor(envConfig);
    this.characterManager = characterManager || new CharacterDatabaseManager();
  }

  /**
   * Main entry point for content generation
   * Requirements: 1.1, 1.2 - Generate complete content with configurable options
   */
  async generateContent(config: OrchestrationConfig, progressCallback?: (progress: GenerationProgress) => void): Promise<ContentResult> {
    try {
      // Store progress callback
      this.progressCallback = progressCallback;
      
      // Validate configuration
      this.validateConfig(config);
      
      // Initialize generation state
      await this.initializeGeneration(config);
      
      // Start progress tracking if enabled
      if (config.enableAutoSave) {
        this.startProgressTracking(config.saveProgressInterval || 30000);
      }

      // Execute the pipeline
      const result = await this.executePipeline();
      
      // Cleanup
      this.cleanup();
      
      return result;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Pause the current generation process
   * Requirements: 2.2 - Pause functionality for long-running generations
   */
  pauseGeneration(): void {
    if (!this.state || !this.state.isRunning) {
      throw new Error('No active generation to pause');
    }

    this.state.isPaused = true;
    this.state.pausedTime = new Date();
    
    this.emit('paused', {
      projectId: this.state.projectId,
      currentStage: this.state.currentStage,
      pausedAt: this.state.pausedTime
    });
  }

  /**
   * Resume a paused generation process
   * Requirements: 2.2 - Resume functionality for long-running generations
   */
  resumeGeneration(): void {
    if (!this.state || !this.state.isPaused) {
      throw new Error('No paused generation to resume');
    }

    this.state.isPaused = false;
    this.state.resumedTime = new Date();
    
    this.emit('resumed', {
      projectId: this.state.projectId,
      currentStage: this.state.currentStage,
      resumedAt: this.state.resumedTime
    });
  }

  /**
   * Get current generation progress
   * Requirements: 2.3 - Progress tracking and status reporting
   */
  getProgress(): GenerationProgress {
    if (!this.state) {
      throw new Error('No active generation');
    }

    const completedStagesCount = this.state.completedStages.length;
    const totalStages = this.PIPELINE_STAGES.length;
    
    // Calculate stage progress (simplified - would be more detailed in real implementation)
    const currentStageProgress = this.calculateCurrentStageProgress();
    
    // Calculate overall progress
    const overallProgress = (completedStagesCount + currentStageProgress) / totalStages;
    
    // Estimate remaining time
    const estimatedTimeRemaining = this.estimateRemainingTime();

    const result: GenerationProgress = {
      currentStage: this.state.currentStage,
      completedStages: [...this.state.completedStages],
      totalStages,
      currentStageProgress,
      overallProgress
    };
    
    if (estimatedTimeRemaining !== undefined) {
      result.estimatedTimeRemaining = estimatedTimeRemaining;
    }
    
    return result;
  }

  /**
   * Check if generation is currently running
   */
  isRunning(): boolean {
    return this.state?.isRunning || false;
  }

  /**
   * Check if generation is currently paused
   */
  isPaused(): boolean {
    return this.state?.isPaused || false;
  }

  /**
   * Get current project if available
   */
  getCurrentProject(): ContentProject | null {
    return this.project;
  }

  // Private methods

  private validateConfig(config: OrchestrationConfig): void {
    if (config.maxScenes <= 0) {
      throw new Error('maxScenes must be greater than 0');
    }
    
    if (config.budgetLimit <= 0) {
      throw new Error('budgetLimit must be greater than 0');
    }
    
    if (!config.outputFormats || config.outputFormats.length === 0) {
      throw new Error('At least one output format must be specified');
    }
    
    const validFormats = ['mp4', 'webm', 'avi', 'mov'];
    const invalidFormats = config.outputFormats.filter(format => 
      !validFormats.includes(format.toLowerCase())
    );
    
    if (invalidFormats.length > 0) {
      throw new Error(`Invalid output formats: ${invalidFormats.join(', ')}`);
    }
  }

  private async initializeGeneration(config: OrchestrationConfig): Promise<void> {
    const projectId = uuidv4();
    
    // Initialize project
    this.project = {
      id: projectId,
      topic: config.topic || '',
      idea: '',
      script: {
        title: '',
        description: '',
        scenes: [],
        estimatedDuration: 0
      },
      characters: [],
      scenes: [],
      audioTracks: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCost: 0,
        apiUsage: {
          textGeneration: 0,
          imageGeneration: 0,
          videoGeneration: 0,
          audioGeneration: 0,
          totalRequests: 0
        },
        generationSettings: {
          maxScenes: config.maxScenes,
          budgetLimit: config.budgetLimit,
          useImageToVideo: config.useImageToVideo,
          outputFormats: config.outputFormats,
          quality: config.quality
        }
      }
    };

    // Initialize state
    this.state = {
      projectId,
      currentStage: 'idea_generation',
      isPaused: false,
      isRunning: true,
      startTime: new Date(),
      stageStartTime: new Date(),
      completedStages: [],
      errors: [],
      warnings: []
    };

    // Store config
    this.config = config;

    // Initialize character manager for this project
    this.characterManager.initializeProject(projectId);

    this.emit('initialized', { projectId, config });
  }

  private async executePipeline(): Promise<ContentResult> {
    if (!this.state || !this.project || !this.config) {
      throw new Error('Pipeline not properly initialized');
    }

    try {
      for (const stage of this.PIPELINE_STAGES) {
        // Check if paused
        await this.waitIfPaused();
        
        // Update current stage
        this.updateCurrentStage(stage);
        
        // Execute stage
        await this.executeStage(stage);
        
        // Mark stage as completed
        this.completeStage(stage);
        
        // Check budget after each stage
        const currentUsage = this.costMonitor.getCurrentUsage();
        const budgetUsagePercent = (currentUsage.totalCost / this.config.budgetLimit) * 100;
        
        if (budgetUsagePercent > 80) {
          this.state.warnings.push(`Budget limit approaching after ${stage}: ${budgetUsagePercent.toFixed(1)}% used`);
          this.emit('budgetWarning', { 
            stage, 
            currentCost: currentUsage.totalCost,
            budgetLimit: this.config.budgetLimit,
            usagePercent: budgetUsagePercent
          });
        }
      }

      // Generate final result
      return this.generateResult(true);
      
    } catch (error) {
      this.state.errors.push((error as Error).message);
      return this.generateResult(false);
    }
  }

  private async waitIfPaused(): Promise<void> {
    while (this.state?.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private updateCurrentStage(stage: GenerationStage): void {
    if (!this.state) return;
    
    this.state.currentStage = stage;
    this.state.stageStartTime = new Date();
    
    this.emit('stageStarted', { 
      stage, 
      projectId: this.state.projectId,
      startTime: this.state.stageStartTime 
    });
  }

  private async executeStage(stage: GenerationStage): Promise<void> {
    // This is a simplified implementation - each stage would have detailed logic
    // For now, we'll simulate the stages with basic structure
    
    switch (stage) {
      case 'idea_generation':
        await this.executeIdeaGeneration();
        break;
      case 'script_creation':
        await this.executeScriptCreation();
        break;
      case 'character_analysis':
        await this.executeCharacterAnalysis();
        break;
      case 'image_generation':
        await this.executeImageGeneration();
        break;
      case 'video_generation':
        await this.executeVideoGeneration();
        break;
      case 'audio_generation':
        await this.executeAudioGeneration();
        break;
      case 'content_integration':
        await this.executeContentIntegration();
        break;
      case 'finalization':
        await this.executeFinalization();
        break;
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  private completeStage(stage: GenerationStage): void {
    if (!this.state) return;
    
    this.state.completedStages.push(stage);
    
    const progress = this.getProgress();
    
    // Call progress callback if provided
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    
    this.emit('stageCompleted', { 
      stage, 
      projectId: this.state.projectId,
      completedAt: new Date(),
      progress
    });
  }

  // Placeholder stage execution methods - these would be implemented with actual logic
  private async executeIdeaGeneration(): Promise<void> {
    // Placeholder for idea generation logic
    await this.simulateStageWork('idea_generation');
  }

  private async executeScriptCreation(): Promise<void> {
    // Placeholder for script creation logic
    await this.simulateStageWork('script_creation');
  }

  private async executeCharacterAnalysis(): Promise<void> {
    // Placeholder for character analysis logic
    await this.simulateStageWork('character_analysis');
  }

  private async executeImageGeneration(): Promise<void> {
    // Placeholder for image generation logic
    await this.simulateStageWork('image_generation');
  }

  private async executeVideoGeneration(): Promise<void> {
    // Placeholder for video generation logic
    await this.simulateStageWork('video_generation');
  }

  private async executeAudioGeneration(): Promise<void> {
    // Placeholder for audio generation logic
    await this.simulateStageWork('audio_generation');
  }

  private async executeContentIntegration(): Promise<void> {
    // Placeholder for content integration logic
    await this.simulateStageWork('content_integration');
  }

  private async executeFinalization(): Promise<void> {
    // Placeholder for finalization logic
    await this.simulateStageWork('finalization');
  }

  private async simulateStageWork(stage: GenerationStage): Promise<void> {
    // Simulate work with a small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.emit('stageProgress', { 
      stage, 
      progress: 1.0,
      message: `${stage} completed` 
    });
  }

  private calculateCurrentStageProgress(): number {
    // Simplified progress calculation - would be more sophisticated in real implementation
    return 0.5; // Assume 50% progress for current stage
  }

  private estimateRemainingTime(): number | undefined {
    if (!this.state) return undefined;
    
    const elapsed = Date.now() - this.state.startTime.getTime();
    const completedStages = this.state.completedStages.length;
    const totalStages = this.PIPELINE_STAGES.length;
    
    if (completedStages === 0) return undefined;
    
    const avgTimePerStage = elapsed / completedStages;
    const remainingStages = totalStages - completedStages;
    
    return remainingStages * avgTimePerStage;
  }

  private generateResult(success: boolean): ContentResult {
    if (!this.project || !this.state) {
      throw new Error('Cannot generate result without project and state');
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.state.startTime.getTime();

    const summary: GenerationSummary = {
      totalDuration,
      scenesGenerated: this.project.scenes.length,
      charactersCreated: this.project.characters.length,
      totalCost: this.project.metadata.totalCost,
      apiCallsUsed: this.project.metadata.apiUsage.totalRequests,
      outputFiles: this.project.finalVideo ? [this.project.finalVideo] : []
    };

    const result: ContentResult = {
      project: this.project,
      success,
      errors: [...this.state.errors],
      warnings: [...this.state.warnings],
      summary
    };
    
    if (this.project.finalVideo) {
      result.finalOutputPath = this.project.finalVideo;
    }
    
    return result;
  }

  private startProgressTracking(interval: number): void {
    this.progressSaveInterval = setInterval(() => {
      if (this.state && this.project) {
        this.saveProgress();
      }
    }, interval);
  }

  private saveProgress(): void {
    if (!this.state || !this.project) return;
    
    // Emit progress save event - actual persistence would be handled by external system
    this.emit('progressSaved', {
      projectId: this.state.projectId,
      progress: this.getProgress(),
      timestamp: new Date()
    });
  }

  private cleanup(): void {
    if (this.progressSaveInterval) {
      clearInterval(this.progressSaveInterval);
      this.progressSaveInterval = undefined as any;
    }
    
    if (this.state) {
      this.state.isRunning = false;
    }
    
    this.emit('cleanup', { 
      projectId: this.state?.projectId,
      completedAt: new Date() 
    });
  }

  private handleError(error: Error): void {
    if (this.state) {
      this.state.errors.push(error.message);
    }
    
    this.emit('error', {
      projectId: this.state?.projectId,
      error: error.message,
      stage: this.state?.currentStage,
      timestamp: new Date()
    });
  }

  /**
   * Estimate the cost of a generation run
   * Requirements: 4.2 - Display estimated API costs before proceeding
   */
  async estimateGenerationCost(config: ContentConfig): Promise<number> {
    // Simplified cost estimation - would use actual API pricing in real implementation
    let estimatedCost = 0;
    
    // Base costs per operation type
    const costs = {
      ideaGeneration: 0.01,
      scriptGeneration: 0.02,
      imageGeneration: 0.05,
      videoGeneration: config.useImageToVideo ? 0.15 : 0.10,
      audioGeneration: 0.03,
      integration: 0.01
    };
    
    // Calculate based on configuration
    estimatedCost += costs.ideaGeneration; // Always generate idea
    estimatedCost += costs.scriptGeneration; // Always generate script
    estimatedCost += costs.imageGeneration * (config.useImageToVideo ? config.maxScenes : 0);
    estimatedCost += costs.videoGeneration * config.maxScenes;
    estimatedCost += costs.audioGeneration * config.maxScenes;
    estimatedCost += costs.integration;
    
    // Apply quality multiplier
    const qualityMultipliers = { draft: 0.7, standard: 1.0, high: 1.5 };
    estimatedCost *= qualityMultipliers[config.quality];
    
    return Math.min(estimatedCost, config.budgetLimit);
  }

  /**
   * Get system status including API connectivity and usage
   * Requirements: 4.4 - Display actual API usage and costs incurred
   */
  async getSystemStatus(): Promise<SystemStatus> {
    // Check API connectivity (simplified - would make actual test calls)
    const geminiConnected = !!this.envConfig.geminiApiKey;
    const musicLmConnected = !!this.envConfig.musicLmApiKey;
    
    // Get current usage from cost monitor
    const usage = this.costMonitor.getCurrentUsage();
    
    return {
      geminiConnected,
      musicLmConnected,
      usage: {
        textGeneration: usage.textGeneration,
        imageGeneration: usage.imageGeneration,
        videoGeneration: usage.videoGeneration,
        audioGeneration: usage.audioGeneration,
        totalCost: usage.totalCost
      },
      config: {
        outputDirectory: this.envConfig.outputDirectory,
        maxConcurrentRequests: this.envConfig.maxConcurrentRequests,
        defaultBudgetLimit: this.envConfig.defaultBudgetLimit
      }
    };
  }
}