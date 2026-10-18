import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

async function prerender() {
  console.log('[SSG Prerender] Starting static pre-rendering process...');

  const distPath = path.resolve(process.cwd(), 'dist');
  const templatePath = path.join(distPath, 'index.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`[SSG Prerender Error] dist/index.html not found at: ${templatePath}`);
  }

  // Load the compiled SSR entry point
  const serverEntryPath = path.join(distPath, 'server', 'entry-server.js');
  if (!fs.existsSync(serverEntryPath)) {
    throw new Error(`[SSG Prerender Error] Compiled server entry not found at: ${serverEntryPath}`);
  }

  const serverEntryUrl = pathToFileURL(serverEntryPath).href;
  const { render } = await import(serverEntryUrl);

  if (typeof render !== 'function') {
    throw new Error('[SSG Prerender Error] render function not exported from entry-server');
  }

  const renderedHtml = render();

  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace <div id="root"></div> or <div id="root">...</div>
  const rootRegex = /<div id="root">[\s\S]*?<\/div>/;
  if (!rootRegex.test(template)) {
    throw new Error('[SSG Prerender Error] Could not find <div id="root"> in dist/index.html');
  }

  const newHtml = template.replace(rootRegex, `<div id="root">${renderedHtml}</div>`);

  fs.writeFileSync(templatePath, newHtml, 'utf-8');

  console.log('[SSG Prerender] ✅ Static pre-rendered HTML successfully injected into dist/index.html!');
}

prerender().catch((err) => {
  console.error('[SSG Prerender Failure]:', err);
  process.exit(1);
});
