/**
 * Example demonstrating comprehensive error handling and recovery mechanisms
 */

import { ErrorHandler } from '../utils/error-handler';
import { APIError } from '../types/api';
import { ContentProject } from '../types/content';

async function demonstrateErrorHandling() {
  console.log('🔧 AI Content Generator - Error Handling Demo\n');

  // Initialize error handler with custom configuration
  const errorHandler = new ErrorHandler({
    progressStateDir: './demo-progress',
    enableDetailedLogging: true,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    },
    fallbackStrategies: [
      {
        errorCode: 'CONTENT_FILTERED',
        strategy: 'simplify',
        description: 'Use family-friendly content alternatives'
      },
      {
        errorCode: 'QUOTA_EXCEEDED',
        strategy: 'skip',
        description: 'Skip non-essential operations to stay within quota'
      }
    ]
  });

  // Mock project for demonstration
  const mockProject: ContentProject = {
    id: 'demo-project-456',
    topic: 'Space Adventure',
    idea: 'An exciting journey through the cosmos',
    script: {
      title: 'Cosmic Journey',
      description: 'A thrilling space adventure',
      scenes: [
        {
          id: 'scene-1',
          description: 'Spaceship launch',
          dialogue: ['3, 2, 1... Liftoff!'],
          characters: ['Astronaut'],
          visualCues: ['Rocket launching'],
          duration: 30
        }
      ],
      estimatedDuration: 30
    },
    characters: [
      {
        name: 'Astronaut',
        description: 'Brave space explorer in white suit',
        appearances: []
      }
    ],
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
        maxScenes: 5,
        budgetLimit: 100,
        useImageToVideo: false,
        outputFormats: ['mp4'],
        quality: 'standard'
      }
    }
  };

  try {
    console.log('📝 1. Demonstrating successful operation with error handling...');
    
    // Simulate successful operation
    const successfulOperation = async () => {
      console.log('   Generating video content...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return 'Video generated successfully';
    };

    const result1 = await errorHandler.executeWithErrorHandling(
      successfulOperation,
      {
        operationName: 'video-generation',
        service: 'gemini-video',
        projectId: mockProject.id,
        stage: 'video-generation'
      }
    );
    console.log(`   ✅ ${result1}\n`);

    console.log('💾 2. Saving progress state...');
    await errorHandler.saveProgressState(mockProject, 'video-generation');
    console.log('   ✅ Progress state saved\n');

    console.log('📊 3. Demonstrating error handling with retries...');
    
    let attemptCount = 0;
    const flakyOperation = async () => {
      attemptCount++;
      console.log(`   Attempt ${attemptCount}: Calling API...`);
      
      if (attemptCount < 3) {
        const error: APIError = {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded, please retry',
          retryable: true,
          retryAfter: 1000
        };
        throw error;
      }
      
      return 'Operation succeeded after retries';
    };

    const result2 = await errorHandler.executeWithErrorHandling(
      flakyOperation,
      {
        operationName: 'audio-generation',
        service: 'gemini-audio',
        projectId: mockProject.id,
        stage: 'audio-generation'
      }
    );
    console.log(`   ✅ ${result2}\n`);

    console.log('🚫 4. Demonstrating fallback strategies...');
    
    // Simulate content filtering error
    const contentFilteredError: APIError = {
      code: 'CONTENT_FILTERED',
      message: 'Content was filtered for inappropriate material',
      retryable: false
    };

    const resolution = await errorHandler.handleAPIError(contentFilteredError, {
      operation: 'text-generation',
      service: 'gemini-text',
      projectId: mockProject.id
    });

    console.log(`   Resolution: ${resolution.action}`);
    if (resolution.fallbackPrompt) {
      console.log(`   Fallback: ${resolution.fallbackPrompt}`);
    }
    console.log();

    console.log('⚠️  5. Demonstrating service degradation handling...');
    
    // Simulate service unavailability
    const serviceError: APIError = {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Audio service is temporarily unavailable',
      retryable: false
    };

    await errorHandler.handleAPIError(serviceError, {
      operation: 'audio-generation',
      service: 'gemini-audio'
    });

    const canProceed = await errorHandler.handleServiceDegradation('gemini-audio');
    console.log(`   Can proceed without audio: ${canProceed}`);
    console.log();

    console.log('📋 6. Loading progress state...');
    const loadedState = await errorHandler.loadProgressState(mockProject.id);
    if (loadedState) {
      console.log(`   ✅ Loaded state for project: ${loadedState.projectId}`);
      console.log(`   Current stage: ${loadedState.currentStage}`);
      console.log(`   Completed stages: ${loadedState.completedStages.join(', ')}`);
      console.log(`   Recovery options: ${loadedState.recoveryOptions.length}`);
    }
    console.log();

    console.log('📊 7. Generating comprehensive error report...');
    const errorReport = errorHandler.generateErrorReport(mockProject.id);
    
    console.log(`   Project: ${errorReport.projectId}`);
    console.log(`   Total errors: ${errorReport.errors.length}`);
    console.log(`   Recovery actions: ${errorReport.recoveryActions.length}`);
    console.log(`   System degradation: ${errorReport.systemStatus.degradationLevel}`);
    console.log(`   Recommendations: ${errorReport.recommendations.length}`);
    
    if (errorReport.recommendations.length > 0) {
      console.log('   📝 Recommendations:');
      errorReport.recommendations.forEach((rec, index) => {
        console.log(`      ${index + 1}. ${rec}`);
      });
    }
    console.log();

    console.log('🧹 8. Cleaning up project errors...');
    errorHandler.clearProjectErrors(mockProject.id);
    
    const cleanReport = errorHandler.generateErrorReport(mockProject.id);
    console.log(`   ✅ Project errors cleared: ${cleanReport.errors.length} remaining\n`);

    console.log('✨ Error handling demonstration completed successfully!');
    console.log('\n🔍 Key Features Demonstrated:');
    console.log('   • Automatic retry with exponential backoff');
    console.log('   • Progress state saving and loading');
    console.log('   • Graceful service degradation handling');
    console.log('   • Comprehensive error reporting');
    console.log('   • Fallback strategies for different error types');
    console.log('   • Detailed logging and recovery tracking');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    // Generate final error report
    const finalReport = errorHandler.generateErrorReport();
    console.log('\n📊 Final Error Report:');
    console.log(`   Total system errors: ${finalReport.errors.length}`);
    console.log(`   System status: ${finalReport.systemStatus.degradationLevel}`);
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateErrorHandling().catch(console.error);
}

export { demonstrateErrorHandling };