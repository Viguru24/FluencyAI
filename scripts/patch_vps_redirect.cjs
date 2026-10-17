const fs = require('fs');

const file = '/var/www/cosmowhisper/backend/src/routes/auth.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /if\s*\(\s*platform\s*===\s*'fluency'\s*\|\|\s*finalRedirect\.startsWith\('http'\)\s*\)\s*\{[\s\S]*?const\s+targetUrl\s*=\s*finalRedirect\.startsWith\('http'\)\s*\?\s*finalRedirect\s*:\s*'http:\/\/localhost:5173';/;

const replacement = `if (platform === 'fluency' || finalRedirect.startsWith('http')) {
            let targetUrl = finalRedirect.startsWith('http') ? finalRedirect : 'https://api.cosmowhisper.com/fluency/';
            if (platform === 'fluency' && (targetUrl === 'https://api.cosmowhisper.com' || targetUrl === 'https://api.cosmowhisper.com/')) {
                targetUrl = 'https://api.cosmowhisper.com/fluency/';
            }`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated auth.ts redirect logic');
} else {
  console.log('Target block in auth.ts already updated or regex did not match');
}
