// scripts/create-favicon.mjs
// Creates an optimized favicon.ico from the PNG

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const appDir = path.join(__dirname, '..', 'app');

async function createFavicon() {
    console.log('🔧 Creating optimized favicon...\n');

    const inputPath = path.join(publicDir, 'favicon.png');
    const outputPath = path.join(appDir, 'favicon.ico');

    if (!fs.existsSync(inputPath)) {
        console.log('❌ favicon.png not found in public folder');
        return;
    }

    try {
        // Get original size
        const originalStats = fs.statSync(outputPath);
        const originalSizeKB = (originalStats.size / 1024).toFixed(2);

        // Create a small PNG that browsers will use
        // Modern browsers prefer PNG over ICO for favicons
        await sharp(inputPath)
            .resize(32, 32, { fit: 'cover' })
            .png({
                compressionLevel: 9,
                palette: true,
                effort: 10
            })
            .toFile(outputPath);

        // Get new size
        const newStats = fs.statSync(outputPath);
        const newSizeKB = (newStats.size / 1024).toFixed(2);
        const reduction = ((1 - newStats.size / originalStats.size) * 100).toFixed(1);

        console.log(`✅ favicon.ico: ${originalSizeKB}KB → ${newSizeKB}KB (${reduction}% smaller)`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createFavicon().catch(console.error);
