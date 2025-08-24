/**
 * Example demonstrating the Content Pipeline Orchestrator
 * Shows how to use the orchestrator to coordinate content generation workflow
 */

import { ContentPipelineOrchestrator, OrchestrationConfig } from '../services/content-pipeline-orchestrator';
import { CostMonitor, CostMonitorConfig } from '../services/cost-monitor';
import { CharacterDatabaseManager } from '../managers/character-database-manager';
// Note: GeminiAPIManager will be used in future implementations
// import { GeminiAPIManager } from '../api/gemini-api-manager';

async function demonstrateContentPipeline() {
  console.log('🎬 Content Pipeline Orchestrator Demo');
  console.log('=====================================\n');

  // Initialize dependencies
  const costMonitorConfig: CostMonitorConfig = {
    budgetLimit: 50.0,
    warningThreshold: 0.8,
    trackingPeriod: 'session'
  };

  const costMonitor = new CostMonitor(costMonitorConfig);
  const characterManager = new CharacterDatabaseManager();
  // Note: API manager will be used in future implementations
  // const apiManager = new GeminiAPIManager({ 
  //   apiKey: process.env.GEMINI_API_KEY || 'demo-key',
  //   maxRequestsPerMinute: 60,
  //   maxConcurrentRequests: 5,
  //   defaultModel: 'gemini-pro'
  // });

  // Create orchestrator
  const orchestrator = new ContentPipelineOrchestrator(
    costMonitor,
    characterManager
  );

  // Set up event listeners to track progress
  orchestrator.on('initialized', (data) => {
    console.log(`✅ Pipeline initialized for project: ${data.projectId}`);
  });

  orchestrator.on('stageStarted', (data) => {
    console.log(`🚀 Starting stage: ${data.stage}`);
  });

  orchestrator.on('stageCompleted', (data) => {
    const progress = data.progress;
    const progressPercent = (progress.overallProgress * 100).toFixed(1);
    console.log(`✅ Completed stage: ${data.stage} (${progressPercent}% overall progress)`);
  });

  orchestrator.on('stageProgress', (data) => {
    console.log(`   📊 ${data.stage}: ${data.message}`);
  });

  orchestrator.on('budgetWarning', (data) => {
    console.log(`⚠️  Budget warning at ${data.stage}: ${data.usagePercent.toFixed(1)}% used`);
  });

  orchestrator.on('paused', (data) => {
    console.log(`⏸️  Pipeline paused at stage: ${data.currentStage}`);
  });

  orchestrator.on('resumed', (data) => {
    console.log(`▶️  Pipeline resumed at stage: ${data.currentStage}`);
  });

  orchestrator.on('error', (data) => {
    console.log(`❌ Error in ${data.stage}: ${data.error}`);
  });

  orchestrator.on('cleanup', (data) => {
    console.log(`🧹 Pipeline cleanup completed for project: ${data.projectId}`);
  });

  // Configuration for content generation
  const config: OrchestrationConfig = {
    topic: 'A day in the life of a friendly robot learning to cook',
    maxScenes: 3,
    budgetLimit: 25.0,
    useImageToVideo: false,
    outputFormats: ['mp4'],
    quality: 'standard',
    enableAutoSave: true,
    saveProgressInterval: 5000, // Save progress every 5 seconds
    maxRetries: 3
  };

  try {
    console.log('📋 Configuration:');
    console.log(`   Topic: ${config.topic}`);
    console.log(`   Max Scenes: ${config.maxScenes}`);
    console.log(`   Budget Limit: $${config.budgetLimit}`);
    console.log(`   Quality: ${config.quality}`);
    console.log(`   Auto-save: ${config.enableAutoSave ? 'Enabled' : 'Disabled'}\n`);

    // Start content generation
    console.log('🎬 Starting content generation...\n');
    const startTime = Date.now();

    const result = await orchestrator.generateContent(config);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n📊 Generation Results:');
    console.log('=====================');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Project ID: ${result.project.id}`);
    console.log(`Topic: ${result.project.topic}`);
    
    if (result.summary) {
      console.log('\n📈 Summary:');
      console.log(`   Scenes Generated: ${result.summary.scenesGenerated}`);
      console.log(`   Characters Created: ${result.summary.charactersCreated}`);
      console.log(`   Total Cost: $${result.summary.totalCost.toFixed(4)}`);
      console.log(`   API Calls: ${result.summary.apiCallsUsed}`);
      console.log(`   Output Files: ${result.summary.outputFiles.length}`);
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    // Demonstrate pause/resume functionality
    console.log('\n🎮 Demonstrating Pause/Resume Functionality:');
    console.log('============================================');
    
    // Start another generation to demonstrate pause/resume
    const pauseResumeConfig = { ...config, topic: 'Quick demo for pause/resume' };
    
    const generationPromise = orchestrator.generateContent(pauseResumeConfig);
    
    // Wait a moment then pause
    setTimeout(() => {
      console.log('⏸️  Pausing generation...');
      orchestrator.pauseGeneration();
      
      // Resume after 2 seconds
      setTimeout(() => {
        console.log('▶️  Resuming generation...');
        orchestrator.resumeGeneration();
      }, 2000);
    }, 1000);
    
    await generationPromise;

    // Demonstrate progress tracking
    console.log('\n📊 Progress Tracking Demo:');
    console.log('==========================');
    
    const progressConfig = { ...config, topic: 'Progress tracking demo' };
    const progressPromise = orchestrator.generateContent(progressConfig);
    
    // Monitor progress every second
    const progressInterval = setInterval(() => {
      if (orchestrator.isRunning()) {
        try {
          const progress = orchestrator.getProgress();
          console.log(`📈 Progress: ${(progress.overallProgress * 100).toFixed(1)}% - Current: ${progress.currentStage}`);
        } catch (error) {
          // Generation might have completed
          clearInterval(progressInterval);
        }
      } else {
        clearInterval(progressInterval);
      }
    }, 1000);
    
    await progressPromise;
    clearInterval(progressInterval);

  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);
  }

  console.log('\n🎉 Content Pipeline Orchestrator demo completed!');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateContentPipeline().catch(console.error);
}

export { demonstrateContentPipeline };