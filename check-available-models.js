#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkAvailableModels() {
  console.log('🔍 Checking Available Gemini Models...\n');
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // List available models
    const models = await genAI.listModels();
    
    console.log('📋 Available Models:');
    models.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Description: ${model.description}`);
      console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
    // Look for video-related models
    const videoModels = models.filter(model => 
      model.name.toLowerCase().includes('veo') || 
      model.name.toLowerCase().includes('video') ||
      model.displayName?.toLowerCase().includes('video') ||
      model.description?.toLowerCase().includes('video')
    );
    
    if (videoModels.length > 0) {
      console.log('🎬 Video-related Models Found:');
      videoModels.forEach(model => {
        console.log(`- ${model.name} (${model.displayName})`);
      });
    } else {
      console.log('⚠️  No video-specific models found in the current API version.');
      console.log('   Video generation might be available through other models or API endpoints.');
    }
    
  } catch (error) {
    console.error('❌ Failed to list models:', error.message);
  }
}

checkAvailableModels();