import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Brand, brandLogoAlt, brandLogoSrc, brandSubtitle, brandWordmark } from './ui.js';

describe('Brand constants', () => {
  it('points the visible brand mark at the real app favicon asset', () => {
    expect(brandLogoSrc).toBe('/favicon.ico');
    expect(brandLogoAlt).toBe('TraceLayer logo');
  });

  it('keeps the TraceLayer wordmark and product subtitle stable', () => {
    expect(brandWordmark).toBe('TraceLayer');
    expect(brandSubtitle).toBe('Proof Control Plane');
  });

  it('scopes responsive brand text selectors away from the logo wrapper', () => {
    const markup = renderToStaticMarkup(createElement(Brand));

    expect(markup).toContain('class="logo"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('class="brand-copy"');
  });
});
