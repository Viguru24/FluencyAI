const fs = require('fs');

const filePath = '/var/www/cosmowhisper/backend/src/routes/auth.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add authenticate and AuthRequest import
if (!code.includes('authenticate, type AuthRequest') && !code.includes('authenticate, AuthRequest')) {
  code = code.replace(
    "import { logger } from '../utils/logger.js';",
    "import { logger } from '../utils/logger.js';\nimport { authenticate, type AuthRequest } from '../middleware/auth.js';"
  );
}

// 2. Add formatUserPayload helper
if (!code.includes('const formatUserPayload')) {
  const helper = `
const formatUserPayload = (user: any) => ({
    id: user.id,
    email: user.email,
    name: user.name || (user.email ? user.email.split('@')[0] : 'User'),
    picture: user.picture || null,
    xp: Number(user.xp ?? 0),
    streak: Number(user.streak ?? 0),
    level: user.level || 'B1',
    progress_data: user.progress_data ? (typeof user.progress_data === 'string' ? JSON.parse(user.progress_data) : user.progress_data) : null,
    tier: user.subscription_tier || 'free'
});
`;
  code = code.replace('const router = Router();', 'const router = Router();' + helper);
}

// 3. Update /signup to optionally save name and return token + formatted user
if (code.includes("router.post('/signup'")) {
  code = code.replace(
    /router\.post\('\/signup'[\s\S]*?res\.status\(201\)\.json\(\{\s*message:\s*'User created successfully'\s*\}\);\s*\}\s*catch/,
    `router.post('/signup', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const displayName = name ? name.trim() : email.split('@')[0];
        await sql\`
            INSERT INTO users (email, password_hash, name, xp, streak, level)
            VALUES (\${email.toLowerCase().trim()}, \${passwordHash}, \${displayName}, 0, 0, 'B1')
        \`;
        const users = await sql\`SELECT id, email, name, picture, xp, streak, level, progress_data, subscription_tier FROM users WHERE email = \${email.toLowerCase().trim()}\`;
        const user = users[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, tier: user.subscription_tier },
            process.env.JWT_SECRET!,
            { expiresIn: '30d' }
        );
        res.status(201).json({ message: 'User created successfully', token, user: formatUserPayload(user) });
    } catch`
  );
}

// 4. Update /login to query full user fields and return formatted user
code = code.replace(
  /SELECT id, email, password_hash, subscription_tier\s+FROM users\s+WHERE email = \$\{email\.toLowerCase\(\)\.trim\(\)\}/,
  `SELECT id, email, name, picture, xp, streak, level, progress_data, password_hash, subscription_tier FROM users WHERE email = \${email.toLowerCase().trim()}`
);

code = code.replace(
  /res\.json\(\{\s*token,\s*user:\s*\{\s*email:\s*user\.email,\s*tier:\s*user\.subscription_tier\s*\}\s*\}\);/,
  `res.json({ token, user: formatUserPayload(user) });`
);

// 5. Update /verify-otp to include full user fields
code = code.replace(
  /res\.json\(\{\s*token,\s*user:\s*\{\s*email:\s*user\.email,\s*tier:\s*user\.subscription_tier,\s*name:\s*user\.email\.split\('@'\)\[0\]\s*\}\s*\}\);/,
  `res.json({ token, user: formatUserPayload(user) });`
);

// 6. Update Google Callback to support FluencyAI / redirect URLs
if (!code.includes("platform === 'fluency' || finalRedirect.startsWith('http')")) {
  const googleRedirectEnhance = `
        const userPayload = formatUserPayload(user);
        const userJson = JSON.stringify(userPayload);

        if (platform === 'fluency' || finalRedirect.startsWith('http')) {
            const targetUrl = finalRedirect.startsWith('http') ? finalRedirect : 'http://localhost:5173';
            const separator = targetUrl.includes('?') ? '&' : '?';
            return res.redirect(\`\${targetUrl}\${separator}token=\${token}&user=\${encodeURIComponent(userJson)}\`);
        }
`;
  code = code.replace(
    "if (platform === 'web') {",
    googleRedirectEnhance + "\n        if (platform === 'web') {"
  );
}

// 7. Add /me, /progress, /profile
if (!code.includes("router.get('/me'")) {
  const extraEndpoints = `
// GET /api/auth/me — Current authenticated user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const users = await sql\`
            SELECT id, email, name, picture, xp, streak, level, progress_data, subscription_tier, created_at 
            FROM users 
            WHERE id = \${req.user!.id}
        \`;
        const user = users[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user: formatUserPayload(user) });
    } catch (err: any) {
        console.error('[AUTH ME ERROR]', err);
        res.status(500).json({ error: 'Failed to retrieve profile', details: err.message });
    }
});

// POST /api/auth/progress — Sync user XP, streak, CEFR level, progress data
router.post('/progress', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        const { xp, completedXP, streak, streakDays, level, progress_data, name, picture } = req.body;
        const effectiveXP = xp !== undefined ? xp : completedXP;
        const effectiveStreak = streak !== undefined ? streak : streakDays;

        const currentUserRes = await sql\`SELECT id, email, name, picture, xp, streak, level, progress_data, subscription_tier FROM users WHERE id = \${userId}\`;
        const current = currentUserRes[0] || {};

        const newName = (name !== undefined && name !== null) ? String(name).trim() : current.name;
        const newPicture = (picture !== undefined) ? picture : current.picture;
        const newXP = effectiveXP !== undefined ? Number(effectiveXP) : (current.xp ?? 0);
        const newStreak = effectiveStreak !== undefined ? Number(effectiveStreak) : (current.streak ?? 0);
        const newLevel = level !== undefined ? String(level) : (current.level || 'B1');
        const newProgressData = progress_data !== undefined 
            ? (typeof progress_data === 'string' ? progress_data : JSON.stringify(progress_data))
            : current.progress_data;

        await sql\`
            UPDATE users 
            SET name = \${newName},
                picture = \${newPicture},
                xp = \${newXP},
                streak = \${newStreak},
                level = \${newLevel},
                progress_data = \${newProgressData},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = \${userId}
        \`;

        res.json({
            success: true,
            user: formatUserPayload({
                ...current,
                name: newName,
                picture: newPicture,
                xp: newXP,
                streak: newStreak,
                level: newLevel,
                progress_data: newProgressData
            })
        });
    } catch (err: any) {
        console.error('[AUTH PROGRESS SYNC ERROR]', err);
        res.status(500).json({ error: 'Failed to sync progress', details: err.message });
    }
});

// PUT /api/auth/profile — Update user display name and avatar
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id;
        const { name, picture } = req.body;

        const currentRes = await sql\`SELECT id, email, name, picture, xp, streak, level, progress_data, subscription_tier FROM users WHERE id = \${userId}\`;
        const current = currentRes[0] || {};

        const updatedName = (name !== undefined && name !== null) ? String(name).trim() : current.name;
        const updatedPicture = (picture !== undefined) ? picture : current.picture;

        await sql\`
            UPDATE users 
            SET name = \${updatedName},
                picture = \${updatedPicture},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = \${userId}
        \`;

        res.json({
            success: true,
            user: formatUserPayload({
                ...current,
                name: updatedName,
                picture: updatedPicture
            })
        });
    } catch (err: any) {
        console.error('[AUTH PROFILE UPDATE ERROR]', err);
        res.status(500).json({ error: 'Failed to update profile', details: err.message });
    }
});
`;
  code = code.replace('export default router;', extraEndpoints + '\nexport default router;');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('auth.ts updated successfully!');
