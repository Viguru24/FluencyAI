import re

conf_path = '/etc/nginx/sites-available/cosmowhisper.com.conf'
with open(conf_path, 'r') as f:
    text = f.read()

old_block = """    # Fluency AI Icons & Manifest
    location ~* ^/fluency/.*\\.(png|svg|ico|webmanifest|json)$ {
        root /opt;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }"""

new_block = """    # Fluency AI Manifest & Service Worker (Strict PWA MIME types & no-cache)
    location ~* ^/fluency/(manifest\\.(webmanifest|json)|sw\\.js)$ {
        root /opt;
        default_type application/manifest+json;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Access-Control-Allow-Origin "*";
    }

    # Fluency AI Icons
    location ~* ^/fluency/.*\\.(png|svg|ico)$ {
        root /opt;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        add_header Access-Control-Allow-Origin "*";
    }"""

if old_block in text:
    updated = text.replace(old_block, new_block)
    with open('/tmp/cosmowhisper_updated.conf', 'w') as f:
        f.write(updated)
    print('SUCCESS: Created /tmp/cosmowhisper_updated.conf')
elif 'location ~* ^/fluency/(manifest' in text:
    print('Already updated!')
else:
    print('ERROR: Old block not found in conf!')
