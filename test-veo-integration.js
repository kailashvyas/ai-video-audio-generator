#!/usr/bin/env node

import { GeminiAPIManager } from './src/api/gemini-api-manager.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testVeoIntegration() {
  console.log('🎬 Testing Veo Video Generation Integration...\n');
  
  try {
    // Initialize API manager
    const apiManager = new GeminiAPIManager({
      apiKey: process.env.GEMINI_API_KEY,
      maxRequestsPerMinute: 60,
      maxConcurrentRequests: 5,
      defaultModel: 'veo-001'
    });
    
    console.log('✅ API Manager created with Veo model');
    
    // Test 1: Text-to-Video Generation
    console.log('\n🎥 Testing Text-to-Video Generation...');
    const textPrompt = "A cute cat wearing a top hat, dancing gracefully in a sunlit garden. The cat spins and leaps with joy, its hat staying perfectly in place.";
    
    try {
      const textToVideoResult = await apiManager.generateTextToVideo(textPrompt, {
        duration: 5,
        aspectRatio: '16:9',
        quality: 'standard'
      });
      
      console.log('✅ Text-to-Video generation successful!');
      console.log(`   Video URL: ${textToVideoResult.url}`);
      console.log(`   Duration: ${textToVideoResult.duration}s`);
      console.log(`   Resolution: ${textToVideoResult.width}x${textToVideoResult.height}`);
      console.log(`   File size: ${(textToVideoResult.size / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      console.error('❌ Text-to-Video failed:', error.message);
    }
    
    // Test 2: Direct Video Generation (legacy method)
    console.log('\n🎬 Testing Direct Video Generation...');
    const directPrompt = "A magical transformation scene where a regular house cat discovers a glowing top hat and transforms into an elegant dancer.";
    
    try {
      const directVideoResult = await apiManager.generateVideo(directPrompt);
      
      console.log('✅ Direct video generation successful!');
      console.log(`   Video URL: ${directVideoResult.url}`);
      console.log(`   Duration: ${directVideoResult.duration}s`);
      console.log(`   Format: ${directVideoResult.format}`);
      
    } catch (error) {
      console.error('❌ Direct video generation failed:', error.message);
    }
    
    console.log('\n🎉 Veo integration test completed!');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testVeoIntegration();