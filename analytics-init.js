/**
 * Vercel Web Analytics Initialization
 * Automatically tracks page views and provides custom event tracking
 * 
 * Usage:
 *   - Page views are tracked automatically
 *   - For custom events: window.vaTrack('event_name', { property: 'value' })
 */

import { inject, track } from './analytics.mjs';

// Initialize Vercel Analytics
inject({
  mode: 'auto', // Automatically detects development vs production
  debug: false
});

// Make track function available globally for custom event tracking
window.vaTrack = track;

// Log initialization in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('[Vercel Analytics] Initialized (development mode - not tracking)');
} else {
  console.log('[Vercel Analytics] Initialized and ready to track');
}
