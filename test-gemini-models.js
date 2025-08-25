#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGeminiModels() {
  console.log('🔍 Testing Gemini Models for Video Generation...\n');
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Test different model names that might support video
    const modelsToTest = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro-vision',
      'veo-001',
      'gemini-2.0-flash-thinking-exp'
    ];
    
    for (const modelName of modelsToTest) {
      console.log(`🧪 Testing model: ${modelName}`);
      
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Try a simple text generation first
        const result = await model.generateContent('Hello, can you generate video?');
        const response = result.response.text();
        
        console.log(`✅ ${modelName} - Text generation works`);
        console.log(`   Response: ${response.substring(0, 100)}...`);
        
        // Check if the response mentions video capabilities
        if (response.toLowerCase().includes('video')) {
          console.log(`🎬 ${modelName} - Mentions video capabilities!`);
        }
        
      } catch (error) {
        console.log(`❌ ${modelName} - ${error.message.split('\n')[0]}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGeminiModels();