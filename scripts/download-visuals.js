const fs = require('fs');
const path = require('path');
const https = require('https');

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets', 'visuals');

const emojis = {
  laptop: '1f4bb',
  rocket: '1f680',
  skull: '1f480',
  warning: '26a0',
  robot: '1f916',
  chip: '1f4be',
  globe: '1f30d',
  lock: '1f512',
  chart: '1f4c8',
  dollar: '1f4b2',
  fire: '1f525',
  star: '2b50',
  lightning: '26a1'
};

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 200) {
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        } else if (res.statusCode === 301 || res.statusCode === 302) {
            download(res.headers.location, dest).then(resolve).catch(reject);
        } else {
            console.log(`HTTP ${res.statusCode} for ${url}`);
            resolve();
        }
    }).on('error', (err) => reject(err));
  });
}

(async () => {
  for (const [name, code] of Object.entries(emojis)) {
    let url = `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${code}.png`;
    // Fallbacks if some codepoints are slightly different in standard format
    // some emoji require fe0f
    
    // Just try to download
    const dest = path.join(ASSETS_DIR, `${name}.png`);
    await download(url, dest);
    
    // Check if empty, maybe try fe0f
    if (fs.existsSync(dest) && fs.statSync(dest).size < 1000) {
        url = `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${code}_fe0f.png`;
        await download(url, dest);
    }
    
    console.log(`Processed ${name}.png`);
  }
  console.log('Visual assets downloaded.');
})();
