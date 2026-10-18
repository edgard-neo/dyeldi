import React from 'react';
import { renderToString } from 'react-dom/server';
import SeoLandingContent from './components/SeoLandingContent';

/**
 * Server-side entry point for pre-rendering static SEO HTML during build time.
 */
export function render(): string {
  return renderToString(<SeoLandingContent />);
}
