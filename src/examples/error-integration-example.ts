/**
 * Example demonstrating ErrorHandler integration with existing services
 */

import { ErrorHandler } from '../utils/error-handler';
import { CostMonitor } from '../services/cost-monitor';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
import { APIError } from '../types/api';

/**
 * Enhanced service wrapper that integrates error handling
 */
class EnhancedService {
  private errorHandler: ErrorHandler;
  private costMonitor: CostMonitor;
  private characterManager: CharacterDatabaseManager;

  constructor() {
    this.errorHandler = new ErrorHandler({
      enableDetailedLogging: true,
      progressStateDir: './service-progress'
    });
    
    this.costMonitor = new CostMonitor({
      budgetLimit: 1000, // Higher budget for demo
      enableAlerts: true
    });
    
    this.characterManager = new CharacterDatabaseManager();
  }

  /**
   * Enhanced video generation with comprehensive error handling
   */
  async generateVideoWithErrorHandling(
    prompt: string, 
    projectId: string,
    characters: string[] = []
  ): Promise<string> {
    return this.errorHandler.executeWithErrorHandling(
      async () => {
        // Check service availability first
        const canProceed = await this.errorHandler.handleServiceDegradation('gemini-video');
        if (!canProceed) {
          throw new Error('Video generation service unavailable');
        }

        // Check budget before expensive operation
        const plannedOperation = {
          type: 'video' as const,
          model: 'veo',
          inputSize: prompt.length,
          complexity: 'medium' as const
        };
        
        const budgetCheck = this.costMonitor.checkBudgetLimit([plannedOperation]);
        console.log(`   💰 Budget check: ${budgetCheck.canProceed}, estimated: $${budgetCheck.estimatedCost}, remaining: $${budgetCheck.remainingBudget}`);
        
        if (!budgetCheck.canProceed) {
          const error: APIError = {
            code: 'BUDGET_EXCEEDED',
            message: `Operation would exceed budget limit. Estimated: $${budgetCheck.estimatedCost}, Remaining: $${budgetCheck.remainingBudget}`,
            retryable: false
          };
          throw error;
        }

        // Enhance prompt with character consistency
        let enhancedPrompt = prompt;
        if (characters.length > 0) {
          const characterDescriptions = characters.map(name => 
            this.characterManager.getCharacterDescription(name)
          ).filter(desc => desc);
          
          if (characterDescriptions.length > 0) {
            enhancedPrompt = `${prompt}\n\nCharacter details: ${characterDescriptions.join(', ')}`;
          }
        }

        // Simulate video generation (would call actual API)
        console.log(`   🎬 Generating video with prompt: "${enhancedPrompt.substring(0, 50)}..."`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Track successful operation
        this.costMonitor.trackAPICall(plannedOperation, budgetCheck.estimatedCost);

        return `video_${Date.now()}.mp4`;
      },
      {
        operationName: 'video-generation',
        service: 'gemini-video',
        projectId,
        stage: 'video-generation'
      }
    );
  }

  /**
   * Enhanced audio generation with fallback strategies
   */
  async generateAudioWithErrorHandling(
    text: string,
    projectId: string
  ): Promise<string | null> {
    try {
      return await this.errorHandler.executeWithErrorHandling(
        async () => {
          // Check service availability
          const canProceed = await this.errorHandler.handleServiceDegradation('gemini-audio');
          if (!canProceed) {
            console.log('   🔇 Audio service unavailable - generating silent video');
            return null;
          }

          // Simulate audio generation
          console.log(`   🎵 Generating audio for: "${text.substring(0, 30)}..."`);
          await new Promise(resolve => setTimeout(resolve, 800));

          const audioOperation = {
            type: 'audio' as const,
            model: 'text-to-speech',
            inputSize: text.length,
            complexity: 'low' as const
          };
          
          const audioCost = this.costMonitor.estimateOperationCost(audioOperation);
          this.costMonitor.trackAPICall(audioOperation, audioCost);

          return `audio_${Date.now()}.mp3`;
        },
        {
          operationName: 'audio-generation',
          service: 'gemini-audio',
          projectId,
          stage: 'audio-generation'
        }
      );
    } catch (error) {
      // Graceful degradation - continue without audio
      console.log('   ⚠️  Audio generation failed, continuing without audio');
      return null;
    }
  }

  /**
   * Get comprehensive status including error information
   */
  getServiceStatus(projectId?: string) {
    const errorReport = this.errorHandler.generateErrorReport(projectId);
    const costReport = this.costMonitor.generateCostReport();
    
    return {
      errors: errorReport,
      costs: costReport,
      characters: this.characterManager.getAllCharacters(),
      systemHealth: {
        degradationLevel: errorReport.systemStatus.degradationLevel,
        budgetRemaining: costReport.totalCost < this.costMonitor['config'].budgetLimit,
        recommendations: errorReport.recommendations
      }
    };
  }

  /**
   * Save and load project state for recovery
   */
  async saveProjectState(projectId: string, stage: string) {
    const mockProject = {
      id: projectId,
      topic: 'Integration Test',
      idea: 'Testing error handling integration',
      script: { title: 'Test', description: 'Test', scenes: [], estimatedDuration: 0 },
      characters: this.characterManager.getAllCharacters(),
      scenes: [],
      audioTracks: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCost: this.costMonitor.getCurrentUsage().totalCost,
        apiUsage: {
          textGeneration: 0,
          imageGeneration: 0,
          videoGeneration: 1,
          audioGeneration: 1,
          totalRequests: 2
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

    await this.errorHandler.saveProgressState(mockProject, stage);
  }

  async loadProjectState(projectId: string) {
    return await this.errorHandler.loadProgressState(projectId);
  }
}

async function demonstrateServiceIntegration() {
  console.log('🔗 AI Content Generator - Service Integration Demo\n');

  const enhancedService = new EnhancedService();
  const projectId = 'integration-test-789';

  try {
    console.log('1. Setting up characters for consistency...');
    // Access the character manager from the enhanced service
    enhancedService['characterManager'].addCharacter('Hero', 'Brave warrior in shining armor with blue cape');
    enhancedService['characterManager'].addCharacter('Villain', 'Dark sorcerer in black robes with glowing red eyes');
    console.log('   ✅ Characters configured\n');

    console.log('2. Generating video with error handling...');
    const videoResult = await enhancedService.generateVideoWithErrorHandling(
      'Epic battle between hero and villain in ancient castle',
      projectId,
      ['Hero', 'Villain']
    );
    console.log(`   ✅ Video generated: ${videoResult}\n`);

    console.log('3. Generating audio with fallback handling...');
    const audioResult = await enhancedService.generateAudioWithErrorHandling(
      'In a time of darkness, a hero rises to face the ultimate evil',
      projectId
    );
    if (audioResult) {
      console.log(`   ✅ Audio generated: ${audioResult}`);
    } else {
      console.log('   ⚠️  Continuing without audio');
    }
    console.log();

    console.log('4. Saving project state for recovery...');
    await enhancedService.saveProjectState(projectId, 'content-integration');
    console.log('   ✅ Project state saved\n');

    console.log('5. Simulating service degradation...');
    // Simulate multiple errors to degrade audio service
    const audioError: APIError = {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Audio service temporarily unavailable',
      retryable: false
    };

    // This would normally be handled internally, but we're demonstrating
    const errorHandler = new ErrorHandler();
    await errorHandler.handleAPIError(audioError, { service: 'gemini-audio' });
    
    console.log('   Attempting audio generation with degraded service...');
    const degradedAudioResult = await enhancedService.generateAudioWithErrorHandling(
      'Backup narration text',
      projectId
    );
    
    if (!degradedAudioResult) {
      console.log('   ✅ Gracefully handled service degradation\n');
    }

    console.log('6. Loading project state...');
    const loadedState = await enhancedService.loadProjectState(projectId);
    if (loadedState) {
      console.log(`   ✅ Loaded project: ${loadedState.projectId}`);
      console.log(`   Current stage: ${loadedState.currentStage}`);
      console.log(`   Recovery options: ${loadedState.recoveryOptions.length}\n`);
    }

    console.log('7. Getting comprehensive service status...');
    const status = enhancedService.getServiceStatus(projectId);
    
    console.log(`   System degradation: ${status.systemHealth.degradationLevel}`);
    console.log(`   Budget remaining: ${status.systemHealth.budgetRemaining}`);
    console.log(`   Total errors: ${status.errors.errors.length}`);
    console.log(`   Total cost: $${status.costs.totalCost.toFixed(2)}`);
    console.log(`   Characters: ${status.characters.length}`);
    
    if (status.systemHealth.recommendations.length > 0) {
      console.log('   📝 System recommendations:');
      status.systemHealth.recommendations.forEach((rec, index) => {
        console.log(`      ${index + 1}. ${rec}`);
      });
    }
    console.log();

    console.log('✨ Service integration demonstration completed successfully!');
    console.log('\n🔍 Integration Benefits Demonstrated:');
    console.log('   • Seamless error handling across all services');
    console.log('   • Automatic progress state management');
    console.log('   • Graceful degradation with fallback strategies');
    console.log('   • Unified status reporting and monitoring');
    console.log('   • Character consistency with error recovery');
    console.log('   • Budget-aware operation with error prevention');

  } catch (error) {
    console.error('❌ Integration demo failed:', error);
    
    const status = enhancedService.getServiceStatus(projectId);
    console.log('\n📊 Final Status Report:');
    console.log(`   System health: ${status.systemHealth.degradationLevel}`);
    console.log(`   Total errors: ${status.errors.errors.length}`);
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateServiceIntegration().catch(console.error);
}

export { demonstrateServiceIntegration, EnhancedService };