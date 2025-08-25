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
import { GeminiAPIManager } from '../api/gemini-api-manager';
import { VeoAPIManager } from '../api/veo-api-manager';
import { IdeaGenerator, GeneratedIdea } from './idea-generator';
import { ScriptGenerator } from './script-generator';
// import { ImageGenerator } from './image-generator'; // Currently unused
import { TextToVideoGenerator } from './text-to-video-generator';

import { AudioGenerator } from './audio-generator';
import { ContentIntegrator } from './content-integrator';

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
  private generatedIdea: GeneratedIdea | null = null; // Store the full GeneratedIdea object
  private costMonitor: CostMonitor;
  private characterManager: CharacterDatabaseManager;
  private apiManager: GeminiAPIManager;
  private ideaGenerator: IdeaGenerator;
  private scriptGenerator: ScriptGenerator;
  // private imageGenerator: ImageGenerator; // Currently unused
  private textToVideoGenerator: TextToVideoGenerator;

  private audioGenerator: AudioGenerator;
  private contentIntegrator: ContentIntegrator;
  private veoManager: VeoAPIManager;
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
    this.costMonitor = costMonitor || new CostMonitor({
      budgetLimit: envConfig.budgetLimit || 10.0,
      warningThreshold: 0.8,
      trackingPeriod: 'session'
    });
    this.characterManager = characterManager || new CharacterDatabaseManager();
    
    // Initialize API manager and services
    this.apiManager = new GeminiAPIManager({
      apiKey: envConfig.geminiApiKey,
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: envConfig.maxConcurrentRequests,
      defaultModel: 'gemini-1.5-flash'
    });
    
    // Initialize VeoAPIManager for direct image-to-video workflow
    this.veoManager = new VeoAPIManager({
      apiKey: envConfig.geminiApiKey,
      maxRetries: 3,
      pollInterval: 10000,
      timeout: 300000
    });
    
    // Initialize all generation services
    this.ideaGenerator = new IdeaGenerator(this.apiManager);
    this.scriptGenerator = new ScriptGenerator(this.apiManager);
    // this.imageGenerator = new ImageGenerator(this.apiManager); // Currently unused
    
    // Initialize video generators with proper dependencies
    this.textToVideoGenerator = new TextToVideoGenerator(
      this.apiManager,
      this.characterManager,
      {
        maxScenes: envConfig.maxScenes || 5,
        quality: 'standard',
        aspectRatio: '16:9',
        duration: 5
      }
    );
    
    // Removed imageToVideoGenerator - using VeoAPIManager complete workflow instead
    
    this.audioGenerator = new AudioGenerator(this.apiManager);
    this.contentIntegrator = new ContentIntegrator({
      outputDirectory: envConfig.outputDirectory || './output',
      outputFormats: ['mp4'],
      quality: 'standard',
      includeMetadata: true
    });
  }

  /**
   * Main entry point for content generation
   * Requirements: 1.1, 1.2 - Generate complete content with configurable options
   */
  async generateContent(config: OrchestrationConfig, progressCallback?: (progress: GenerationProgress) => void): Promise<ContentResult> {
    try {
      // Store progress callback
      if (progressCallback) {
        this.progressCallback = progressCallback;
      }
      
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

  // Real stage execution methods with actual API calls
  private async executeIdeaGeneration(): Promise<void> {
    if (!this.project || !this.config) throw new Error('Project not initialized');
    
    try {
      const idea = await this.ideaGenerator.generateIdea(
        this.config.topic,
        {
          contentType: 'entertainment',
          targetAudience: 'general',
          duration: 'medium',
          creativity: this.config.quality === 'high' ? 'high' : 'medium'
        }
      );
      
      // Store the idea description as string (as expected by ContentProject)
      this.project.idea = idea.description;
      this.project.topic = idea.title;
      
      // Store the full idea object for script generation
      this.generatedIdea = idea;
      
      // Update cost tracking
      this.costMonitor.trackAPICall(
        { type: 'text', model: 'gemini-1.5-flash', inputSize: 100, outputSize: 50, complexity: 'low' },
        0.01,
        'gemini'
      );
      this.project.metadata.totalCost += 0.01;
      this.project.metadata.apiUsage.textGeneration += 1;
      this.project.metadata.apiUsage.totalRequests += 1;
      
    } catch (error) {
      throw new Error(`Idea generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeScriptCreation(): Promise<void> {
    if (!this.project || !this.config || !this.generatedIdea) throw new Error('Project not initialized or idea not generated');
    
    try {
      const script = await this.scriptGenerator.generateScript(
        this.generatedIdea,
        {
          maxScenes: this.config.maxScenes,
          sceneLength: 'medium',
          narrativeStyle: 'storytelling',
          includeDialogue: true
        }
      );
      
      this.project.script = script;
      
      // Update cost tracking
      this.costMonitor.trackAPICall(
        { type: 'text', model: 'gemini-1.5-flash', inputSize: 200, outputSize: 100, complexity: 'medium' },
        0.02,
        'gemini'
      );
      this.project.metadata.totalCost += 0.02;
      this.project.metadata.apiUsage.textGeneration += 1;
      this.project.metadata.apiUsage.totalRequests += 1;
      
    } catch (error) {
      throw new Error(`Script creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCharacterAnalysis(): Promise<void> {
    if (!this.project) throw new Error('Project not initialized');
    
    try {
      // Extract characters from script
      const characters = await this.characterManager.extractCharactersFromScript(
        this.project.script.scenes
      );
      
      this.project.characters = characters;
      
      // Update cost tracking (minimal cost for character analysis)
      this.costMonitor.trackAPICall(
        { type: 'text', model: 'gemini-1.5-flash', inputSize: 50, outputSize: 25, complexity: 'low' },
        0.005,
        'gemini'
      );
      this.project.metadata.totalCost += 0.005;
      this.project.metadata.apiUsage.textGeneration += 1;
      this.project.metadata.apiUsage.totalRequests += 1;
      
    } catch (error) {
      throw new Error(`Character analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeImageGeneration(): Promise<void> {
    if (!this.project || !this.config) throw new Error('Project not initialized');
    
    // Skip separate image generation when using complete image-to-video workflow
    // Images will be generated directly in the video generation stage
    if (this.config.useImageToVideo) {
      console.log('🖼️ Skipping separate image generation - using complete image-to-video workflow');
      return;
    }
    
    // This stage is only needed for non-image-to-video workflows
    console.log('🖼️ No separate image generation needed for text-to-video workflow');
  }

  private async executeVideoGeneration(): Promise<void> {
    if (!this.project || !this.config) throw new Error('Project not initialized');
    
    try {
      // Generate videos for each scene
      for (const scriptScene of this.project.script.scenes) {
        let videoResult;
        
        if (this.config.useImageToVideo) {
          // Use complete image-to-video workflow to avoid format issues
          // Generate image prompt for this scene
          const imagePrompt = `${scriptScene.description}. Cinematic style, high quality, detailed.`;
          
          videoResult = await this.veoManager.generateImageToVideoComplete(
            imagePrompt,
            scriptScene.description,
            {
              duration: scriptScene.duration,
              quality: this.config.quality,
              resolution: '720p',
              model: 'veo-3.0-fast-generate-preview'
            }
          );
        } else {
          // Text-to-video generation
          videoResult = await this.textToVideoGenerator.generateVideo(
            scriptScene.description,
            {
              duration: scriptScene.duration,
              quality: this.config.quality,
              style: 'cinematic'
            }
          );
        }
        
        if (videoResult) {
          // Update or create scene
          let scene = this.project.scenes.find(s => s.scriptSceneId === scriptScene.id);
          if (!scene) {
            scene = {
              id: scriptScene.id,
              scriptSceneId: scriptScene.id,
              videoPrompt: scriptScene.description,
              status: 'pending' as const
            };
            this.project.scenes.push(scene);
          }
          
          scene.generatedVideo = videoResult.url;
          scene.status = 'completed';
          
          // Update cost tracking
          const videoCost = this.config.useImageToVideo ? 0.15 : 0.10;
          this.costMonitor.trackAPICall(
            { type: 'video', model: 'veo', inputSize: scriptScene.duration, outputSize: 1, complexity: 'high' },
            videoCost,
            'veo'
          );
          this.project.metadata.totalCost += videoCost;
          this.project.metadata.apiUsage.videoGeneration += 1;
          this.project.metadata.apiUsage.totalRequests += 1;
        }
      }
      
    } catch (error) {
      throw new Error(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeAudioGeneration(): Promise<void> {
    if (!this.project || !this.config) throw new Error('Project not initialized');
    
    try {
      // Generate audio for each scene with dialogue
      for (const scriptScene of this.project.script.scenes) {
        if (scriptScene.dialogue && scriptScene.dialogue.length > 0) {
          const audioResult = await this.audioGenerator.generateAudio(
            scriptScene.dialogue.join(' '),
            {
              voice: 'neutral',
              speed: 1.0,
              quality: this.config.quality
            }
          );
          
          const audioTrack = {
            type: 'narration' as const,
            content: audioResult.url,
            duration: scriptScene.duration,
            volume: 0.8
          };
          
          this.project.audioTracks.push(audioTrack);
          
          // Update cost tracking
          this.costMonitor.trackAPICall(
            { type: 'audio', model: 'text-to-speech', inputSize: scriptScene.dialogue.join(' ').length, outputSize: scriptScene.duration, complexity: 'medium' },
            0.03,
            'gemini'
          );
          this.project.metadata.totalCost += 0.03;
          this.project.metadata.apiUsage.audioGeneration += 1;
          this.project.metadata.apiUsage.totalRequests += 1;
        }
      }
      
    } catch (error) {
      throw new Error(`Audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeContentIntegration(): Promise<void> {
    if (!this.project || !this.config) throw new Error('Project not initialized');
    
    try {
      // Integrate all content into final video
      const finalVideo = await this.contentIntegrator.integrateContent(this.project);
      
      this.project.finalVideo = finalVideo.outputFiles[0]?.path || '';
      
      // Update cost tracking (minimal cost for integration)
      this.costMonitor.trackAPICall(
        { type: 'text', model: 'integration', inputSize: 10, outputSize: 5, complexity: 'low' },
        0.01,
        'system'
      );
      this.project.metadata.totalCost += 0.01;
      this.project.metadata.apiUsage.totalRequests += 1;
      
    } catch (error) {
      throw new Error(`Content integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeFinalization(): Promise<void> {
    if (!this.project) throw new Error('Project not initialized');
    
    try {
      // Update project metadata
      this.project.metadata.updatedAt = new Date();
      
      // Ensure output directory exists
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const outputDir = path.join(this.envConfig.outputDirectory, this.project.id);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save project metadata
      const projectFile = path.join(outputDir, 'project.json');
      await fs.writeFile(projectFile, JSON.stringify(this.project, null, 2));
      
    } catch (error) {
      throw new Error(`Finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  private calculateCurrentStageProgress(): number {
    if (!this.state) return 0;
    
    // Calculate progress based on elapsed time in current stage
    const elapsed = Date.now() - this.state.stageStartTime.getTime();
    const estimatedStageTime = this.getEstimatedStageTime(this.state.currentStage);
    
    return Math.min(elapsed / estimatedStageTime, 0.95); // Cap at 95% until completion
  }
  
  private getEstimatedStageTime(stage: GenerationStage): number {
    // Estimated time in milliseconds for each stage
    const stageTimes = {
      'idea_generation': 5000,      // 5 seconds
      'script_creation': 10000,     // 10 seconds
      'character_analysis': 3000,   // 3 seconds
      'image_generation': 15000,    // 15 seconds per scene
      'video_generation': 30000,    // 30 seconds per scene
      'audio_generation': 10000,    // 10 seconds per scene
      'content_integration': 20000, // 20 seconds
      'finalization': 5000          // 5 seconds
    };
    
    let baseTime = stageTimes[stage] || 10000;
    
    // Multiply by number of scenes for generation stages
    if (['image_generation', 'video_generation', 'audio_generation'].includes(stage) && this.config) {
      baseTime *= this.config.maxScenes;
    }
    
    return baseTime;
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
        textGeneration: 0, // Default values since these aren't tracked in UsageStats
        imageGeneration: 0,
        videoGeneration: 0,
        audioGeneration: 0,
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