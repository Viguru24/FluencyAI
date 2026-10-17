const fs = require('fs');

const file = '/var/www/cosmowhisper/backend/src/index.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const authLimiter = rateLimit\(\{[\s\S]*?message:\s*\{[\s\S]*?\}\s*\}\);/;

const replacement = `const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
  skip: (req: Request) => {
    const url = req.originalUrl || req.url || '';
    if (url.includes('/google') || url.includes('/me') || url.includes('/progress') || url.includes('/profile')) {
      return true;
    }
    const authHeader = req.headers['authorization'];
    return !!(authHeader && authHeader.startsWith('Bearer '));
  }
});`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched authLimiter in index.ts');
} else {
  console.error('Target authLimiter regex not matched in ' + file);
  process.exit(1);
}
