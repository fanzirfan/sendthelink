// scripts/optimize-images.mjs
// Run with: node scripts/optimize-images.mjs

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const imagesToOptimize = [
    {
        input: 'favicon.png',
        output: 'favicon.png',
        width: 64,
        height: 64,
        quality: 80
    },
    {
        input: 'apple-icon.png',
        output: 'apple-icon.png',
        width: 180,
        height: 180,
        quality: 80
    },
    {
        input: 'og-image.png',
        output: 'og-image.png',
        width: 1200,
        height: 630,
        quality: 85
    },
    {
        input: 'banner.png',
        output: 'banner.png',
        width: 1200,
        height: null, // Auto height
        quality: 80
    },
];

async function optimizeImages() {
    console.log('🖼️ Starting image optimization...\n');

    for (const img of imagesToOptimize) {
        const inputPath = path.join(publicDir, img.input);
        const outputPath = path.join(publicDir, img.output);
        const backupPath = path.join(publicDir, `${path.basename(img.input, '.png')}_original.png`);

        if (!fs.existsSync(inputPath)) {
            console.log(`⚠️ Skipping ${img.input} - file not found`);
            continue;
        }

        try {
            // Get original size
            const originalStats = fs.statSync(inputPath);
            const originalSizeKB = (originalStats.size / 1024).toFixed(2);

            // Create backup if it doesn't exist
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(inputPath, backupPath);
                console.log(`📦 Backed up original: ${path.basename(backupPath)}`);
            }

            // Optimize the image
            let sharpInstance = sharp(inputPath);

            if (img.width && img.height) {
                sharpInstance = sharpInstance.resize(img.width, img.height, {
                    fit: 'cover',
                    position: 'center'
                });
            } else if (img.width) {
                sharpInstance = sharpInstance.resize(img.width);
            }

            await sharpInstance
                .png({
                    quality: img.quality,
                    compressionLevel: 9,
                    palette: true,
                    effort: 10
                })
                .toFile(outputPath + '.tmp');

            // Replace original with optimized
            fs.unlinkSync(outputPath);
            fs.renameSync(outputPath + '.tmp', outputPath);

            // Get new size
            const newStats = fs.statSync(outputPath);
            const newSizeKB = (newStats.size / 1024).toFixed(2);
            const reduction = ((1 - newStats.size / originalStats.size) * 100).toFixed(1);

            console.log(`✅ ${img.input}: ${originalSizeKB}KB → ${newSizeKB}KB (${reduction}% smaller)`);
        } catch (error) {
            console.error(`❌ Error optimizing ${img.input}:`, error.message);
        }
    }

    console.log('\n🎉 Image optimization complete!');
}

optimizeImages().catch(console.error);
