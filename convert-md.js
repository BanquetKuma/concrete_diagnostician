const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const srcDir = './docs/legal';
const distDir = './docs/legal/dist';

const files = ['index.md', 'privacy-policy.md', 'terms-of-service.md', 'support.md'];

const htmlTemplate = (title, content) => `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - コンクリート診断士試験対策</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  ${content}
</body>
</html>`;

files.forEach(file => {
  const mdPath = path.join(srcDir, file);
  const htmlFile = file.replace('.md', '.html');
  const htmlPath = path.join(distDir, htmlFile);
  
  const md = fs.readFileSync(mdPath, 'utf8');
  const html = marked(md);
  
  // Extract title from first h1
  const titleMatch = md.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Document';
  
  fs.writeFileSync(htmlPath, htmlTemplate(title, html));
  console.log('Converted:', file, '->', htmlFile);
});

console.log('Done!');
