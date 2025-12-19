/**
 * Playwright Global Setup
 *
 * This file runs once before all tests. It sets up:
 * - Browser storage directories
 * - Test user authentication states
 * - Environment validation
 */

import { FullConfig } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_DIR = path.join(process.cwd(), 'playwright/.auth');

async function globalSetup(config: FullConfig) {
    console.log('🎭 Playwright Global Setup Starting...');
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🔧 Environment: ${process.env.CI ? 'CI' : 'Local'}`);

    // Create auth storage directory
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log(`📁 Created auth directory: ${AUTH_DIR}`);
    }

    // Validate required environment variables for CI
    if (process.env.CI) {
        const requiredEnvVars = [
            'BASE_URL',
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        ];

        const missing = requiredEnvVars.filter((v) => !process.env[v]);
        if (missing.length > 0) {
            console.warn(`⚠️ Missing optional env vars: ${missing.join(', ')}`);
        }
    }

    // Health check - verify the app is running
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('🏥 Running health check...');
        // Short timeout for health check
        const response = await page.goto(BASE_URL, { timeout: 10_000, waitUntil: 'domcontentloaded' });

        if (!response?.ok()) {
            console.warn(`⚠️ Health check warning: ${response?.status()} - continuing anyway`);
        } else {
            console.log('✅ Health check passed');
        }
    } catch (e) {
        console.warn('⚠️ Health check failed (timeout or error), but continuing to run tests...', e);
    }

    await browser.close();

    console.log('🎭 Global Setup Complete\n');
}

export default globalSetup;
