import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const url = 'https://www.designprompts.dev/saas';
const outDir = path.resolve('docs/reference-ui');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

const viewports = [
  { name: 'desktop', width: 1440, height: 2200 },
  { name: 'tablet', width: 834, height: 1800 },
  { name: 'mobile', width: 390, height: 1800 },
];

const captures = {};

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, `${vp.name}.png`), fullPage: true });

  const data = await page.evaluate(() => {
    const pick = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 120),
        className: el.className,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        styles: {
          display: cs.display,
          position: cs.position,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          backgroundImage: cs.backgroundImage,
          border: cs.border,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow,
          padding: cs.padding,
          margin: cs.margin,
          gap: cs.gap,
          maxWidth: cs.maxWidth,
          justifyContent: cs.justifyContent,
          alignItems: cs.alignItems,
          gridTemplateColumns: cs.gridTemplateColumns,
          transition: cs.transition,
        },
      };
    };

    const topNav = document.querySelector('header');
    const heroH1 = [...document.querySelectorAll('h1')].find((h) =>
      (h.textContent || '').includes('Transform the way your team works'),
    );
    const primaryBtn = [...document.querySelectorAll('a,button')].find((x) =>
      (x.textContent || '').toLowerCase().includes('start free trial'),
    );
    const secondaryBtn = [...document.querySelectorAll('a,button')].find((x) =>
      (x.textContent || '').toLowerCase().includes('watch demo'),
    );
    const heroSection = heroH1?.closest('section');

    const headings = [...document.querySelectorAll('h1,h2,h3')].map((el) => pick(el));
    const sections = [...document.querySelectorAll('main section, section')].slice(0, 20).map((el) => pick(el));
    const cards = [...document.querySelectorAll('article, [class*="card"], .card')].slice(0, 30).map((el) => pick(el));
    const interactive = [...document.querySelectorAll('a,button,input,textarea,select')]
      .slice(0, 80)
      .map((el) => pick(el));

    return {
      title: document.title,
      bodyStyle: pick(document.body),
      htmlStyle: pick(document.documentElement),
      topNav: pick(topNav),
      heroSection: pick(heroSection),
      heroHeading: pick(heroH1),
      primaryBtn: pick(primaryBtn),
      secondaryBtn: pick(secondaryBtn),
      headings,
      sections,
      cards,
      interactive,
      fonts: Array.from(document.fonts || []).map((f) => ({
        family: f.family,
        style: f.style,
        weight: f.weight,
        status: f.status,
      })),
    };
  });

  captures[vp.name] = data;
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outDir, 'computed-styles.json'), JSON.stringify(captures, null, 2), 'utf8');
console.log('Saved reference data to', outDir);
