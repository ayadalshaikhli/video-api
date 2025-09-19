#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempVideoDir = path.join(__dirname, 'temp_videos');

console.log('🧹 Cleaning up temp videos...');

if (!fs.existsSync(tempVideoDir)) {
    console.log('📁 No temp_videos folder found. Nothing to clean up.');
    process.exit(0);
}

try {
    const files = fs.readdirSync(tempVideoDir);
    
    if (files.length === 0) {
        console.log('📁 temp_videos folder is empty. Nothing to clean up.');
        process.exit(0);
    }

    console.log(`📁 Found ${files.length} temp video(s) to clean up:`);
    
    files.forEach(file => {
        const filePath = path.join(tempVideoDir, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  - ${file} (${sizeInMB} MB)`);
    });

    // Remove all files
    files.forEach(file => {
        const filePath = path.join(tempVideoDir, file);
        fs.unlinkSync(filePath);
        console.log(`  ✅ Deleted: ${file}`);
    });

    // Remove the directory
    fs.rmdirSync(tempVideoDir);
    console.log('📁 Removed temp_videos directory');
    
    console.log('🎉 Cleanup completed successfully!');
    
} catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
}
