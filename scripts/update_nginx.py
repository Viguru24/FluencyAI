import re

conf_path = '/etc/nginx/sites-available/cosmowhisper.com.conf'
with open(conf_path, 'r') as f:
    content = f.read()

target = 'location /fluency/freellm-gateway/ {'
if target not in content:
    print('Target location /fluency/freellm-gateway/ not found!')
    exit(1)

# Check if /v1/ already exists
if 'location /v1/ {' in content:
    print('/v1/ already present!')
    exit(0)

split_marker = '    # Default CosmoWhisper API (Node Port 5000)'
if split_marker not in content:
    print('Split marker not found!')
    exit(1)

new_blocks = """    # FluencyAI FreeLLMAPI Unified Gateway (Root Domain Proxy)
    location /v1/ {
        proxy_pass http://127.0.0.1:3001/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    location /freellm-gateway/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

"""

new_content = content.replace(split_marker, new_blocks + split_marker, 1)

with open('/tmp/cosmowhisper.com.conf.new', 'w') as f:
    f.write(new_content)

print('Successfully generated /tmp/cosmowhisper.com.conf.new')
