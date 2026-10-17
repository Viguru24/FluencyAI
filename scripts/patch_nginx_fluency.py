import re

conf_path = '/etc/nginx/sites-available/cosmowhisper.com.conf'
with open(conf_path, 'r') as f:
    text = f.read()

new_block = """    # Fluency AI Static Assets (Immutable hashed files)
    location ~* ^/fluency/assets/ {
        root /opt;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Fluency AI Icons & Manifest
    location ~* ^/fluency/.*\\.(png|svg|ico|webmanifest|json)$ {
        root /opt;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Fluency AI PWA Web App (Always fresh index.html)
    location /fluency {
        root /opt;
        index index.html;
        try_files $uri $uri/ /fluency/index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
    }

    # Root Domain Fallback for Favicons & Icons
    location ~* ^/(favicon\\.(ico|svg)|favicon-(16|32)\\.png|icon-(192|512)\\.png|icon-maskable-(192|512)\\.png|logo(-mark|-square)?\\.png|apple-touch-icon\\.png)$ {
        root /opt/fluencyai/dist;
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }"""

pattern = r'    # FluencyAI PWA Web App \(Served globally over HTTPS\)\s+location /fluency \{\s+root /opt;\s+index index\.html;\s+try_files \$uri \$uri/ /fluency/index\.html;\s+expires 1h;\s+add_header Cache-Control "public, max-age=3600";\s+\}'

if 'location ~* ^/fluency/assets/' in text:
    print('Already patched!')
elif re.search(pattern, text):
    updated = re.sub(pattern, new_block, text)
    with open('/tmp/cosmowhisper_patched.conf', 'w') as f:
        f.write(updated)
    print('SUCCESS: Created /tmp/cosmowhisper_patched.conf')
else:
    print('ERROR: Pattern not found in conf!')
