/**
 * Playwright Global Teardown
 *
 * This file runs once after all tests. It handles:
 * - Cleanup of test data
 * - Report generation
 * - Resource cleanup
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
    console.log('\n🎭 Playwright Global Teardown Starting...');

    // Clean up auth state files (optional - keep for debugging)
    const authDir = path.join(process.cwd(), 'playwright/.auth');
    if (fs.existsSync(authDir) && process.env.CI) {
        // In CI, we might want to keep auth files for debugging
        console.log(`📁 Auth state preserved at: ${authDir}`);
    }

    // Summary of test artifacts
    const reportDir = path.join(process.cwd(), 'playwright-report');
    if (fs.existsSync(reportDir)) {
        console.log(`📊 Test reports available at: ${reportDir}`);
    }

    console.log('🎭 Global Teardown Complete');
}

export default globalTeardown;
