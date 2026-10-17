import re

conf_path = '/etc/nginx/sites-available/cosmowhisper.com.conf'
with open(conf_path, 'r') as f:
    text = f.read()

# Replace the 7d icon cache with 1h must-revalidate
old_icon_block = """    # Fluency AI Icons
    location ~* ^/fluency/.*\\.(png|svg|ico)$ {
        root /opt;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        add_header Access-Control-Allow-Origin "*";
    }"""

new_icon_block = """    # Fluency AI Icons
    location ~* ^/fluency/.*\\.(png|svg|ico)$ {
        root /opt;
        expires 1h;
        add_header Cache-Control "public, max-age=3600, must-revalidate";
        add_header Access-Control-Allow-Origin "*";
    }"""

if old_icon_block in text:
    updated = text.replace(old_icon_block, new_icon_block)
    with open('/tmp/cosmowhisper_updated.conf', 'w') as f:
        f.write(updated)
    print('SUCCESS: Created /tmp/cosmowhisper_updated.conf')
elif 'max-age=3600, must-revalidate' in text:
    print('Already updated!')
else:
    print('ERROR: Old icon block not found in conf!')
