/**
 * Cost Optimization Demo
 * Demonstrates the cost differences between various Veo 3.0 settings
 */

import { VeoAPIManager } from '../api/veo-api-manager';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateCostOptimization() {
  console.log('💰 Veo 3.0 Cost Optimization Demo\n');

  // Check for API key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_AI_API_KEY environment variable is required');
    process.exit(1);
  }

  const veoManager = new VeoAPIManager({
    apiKey,
    maxRetries: 3,
    pollInterval: 10000,
    timeout: 300000
  });

  const testPrompt = "A person walking through a peaceful garden with flowers blooming";

  console.log('🎯 Testing different cost optimization settings...\n');

  // Cost-optimized settings (DEFAULT)
  console.log('1️⃣ COST-OPTIMIZED (Recommended Default)');
  console.log('   Model: veo-3.0-fast-generate-preview');
  console.log('   Resolution: 720p');
  console.log('   Estimated cost: ~$0.05-0.10 per scene');
  console.log('   Best for: Social media, web content, testing\n');

  try {
    const costOptimizedResult = await veoManager.generateTextToVideo(testPrompt, {
      duration: 5,
      aspectRatio: '16:9',
      quality: 'standard',
      model: 'veo-3.0-fast-generate-preview', // Cost-optimized
      resolution: '720p' // Cost-optimized
    });

    console.log(`   ✅ Generated: ${costOptimizedResult.url}`);
    console.log(`   📊 File size: ${(costOptimizedResult.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   📐 Resolution: ${costOptimizedResult.width}x${costOptimizedResult.height}\n`);
  } catch (error) {
    console.error('   ❌ Cost-optimized generation failed:', error);
  }

  // Balanced settings
  console.log('2️⃣ BALANCED QUALITY');
  console.log('   Model: veo-3.0-fast-generate-preview');
  console.log('   Resolution: 1080p');
  console.log('   Estimated cost: ~$0.15-0.25 per scene');
  console.log('   Best for: Professional web content\n');

  try {
    const balancedResult = await veoManager.generateTextToVideo(testPrompt, {
      duration: 5,
      aspectRatio: '16:9',
      quality: 'standard',
      model: 'veo-3.0-fast-generate-preview',
      resolution: '1080p' // Higher resolution
    });

    console.log(`   ✅ Generated: ${balancedResult.url}`);
    console.log(`   📊 File size: ${(balancedResult.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   📐 Resolution: ${balancedResult.width}x${balancedResult.height}\n`);
  } catch (error) {
    console.error('   ❌ Balanced generation failed:', error);
  }

  // Premium settings
  console.log('3️⃣ PREMIUM QUALITY');
  console.log('   Model: veo-3.0-generate-preview');
  console.log('   Resolution: 1080p');
  console.log('   Estimated cost: ~$0.25-0.40 per scene');
  console.log('   Best for: Premium productions, final deliverables\n');

  try {
    const premiumResult = await veoManager.generateTextToVideo(testPrompt, {
      duration: 5,
      aspectRatio: '16:9',
      quality: 'high',
      model: 'veo-3.0-generate-preview', // Premium model
      resolution: '1080p'
    });

    console.log(`   ✅ Generated: ${premiumResult.url}`);
    console.log(`   📊 File size: ${(premiumResult.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   📐 Resolution: ${premiumResult.width}x${premiumResult.height}\n`);
  } catch (error) {
    console.error('   ❌ Premium generation failed:', error);
  }

  // Cost comparison summary
  console.log('💡 COST OPTIMIZATION RECOMMENDATIONS\n');
  
  console.log('🟢 START HERE (Most Cost-Effective):');
  console.log('   • Model: veo-3.0-fast-generate-preview');
  console.log('   • Resolution: 720p');
  console.log('   • Quality: standard');
  console.log('   • Perfect for: Testing, social media, web content\n');

  console.log('🟡 UPGRADE WHEN NEEDED:');
  console.log('   • Resolution: 1080p (for professional web content)');
  console.log('   • Model: veo-3.0-generate-preview (for premium quality)');
  console.log('   • Quality: high (for final deliverables)\n');

  console.log('🔴 PREMIUM SETTINGS (Highest Cost):');
  console.log('   • Only use for final, high-quality productions');
  console.log('   • Consider budget impact: 4-8x more expensive');
  console.log('   • Test with cost-optimized settings first\n');

  console.log('📊 BUDGET PLANNING TIPS:');
  console.log('   • 5 scenes @ 720p + fast model ≈ $0.25-0.50 total');
  console.log('   • 5 scenes @ 1080p + standard model ≈ $1.25-2.00 total');
  console.log('   • Always test with defaults before upgrading settings');
  console.log('   • Use draft quality for rapid iteration\n');

  console.log('🎉 Cost optimization demo completed!');
  console.log('💡 Tip: The default settings provide excellent quality for most use cases.');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCostOptimization().catch(console.error);
}

export { demonstrateCostOptimization };