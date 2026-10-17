import os
from PIL import Image
import numpy as np
import base64

src_emblem_jpg = 'C:/Users/louis/.gemini/antigravity/brain/20032ed8-d34e-40f0-82c5-6107af15b31a/.user_uploaded/media_1792240936870_7b450b14.jpg'
src_full_jpg = 'C:/Users/louis/.gemini/antigravity/brain/20032ed8-d34e-40f0-82c5-6107af15b31a/.user_uploaded/media_1792240934266_03042fd3.jpg'

public_dir = os.path.abspath('public')
assets_dir = os.path.abspath('src/assets')

os.makedirs(public_dir, exist_ok=True)
os.makedirs(assets_dir, exist_ok=True)

from rembg import remove

print("1. Removing background from emblem mark...")
inp_emblem = Image.open(src_emblem_jpg)
out_emblem = remove(inp_emblem)

# Find tight bounding box of alpha > 15
arr_emblem = np.array(out_emblem)
mask = arr_emblem[:, :, 3] > 15
rows = np.any(mask, axis=1)
cols = np.any(mask, axis=0)
rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]
cropped_emblem = out_emblem.crop((cmin, rmin, cmax + 1, rmax + 1))
print(f"   Emblem cropped to {cropped_emblem.size}")

print("2. Removing background from full logo...")
inp_full = Image.open(src_full_jpg)
out_full = remove(inp_full)

arr_full = np.array(out_full)
mask_full = arr_full[:, :, 3] > 15
rows_f = np.any(mask_full, axis=1)
cols_f = np.any(mask_full, axis=0)
rmin_f, rmax_f = np.where(rows_f)[0][[0, -1]]
cmin_f, cmax_f = np.where(cols_f)[0][[0, -1]]
cropped_full = out_full.crop((cmin_f, rmin_f, cmax_f + 1, rmax_f + 1))
print(f"   Full logo cropped to {cropped_full.size}")

# Save cut-out logo mark (transparent PNG)
print("3. Saving transparent logo-mark.png...")
cropped_emblem.save(os.path.join(public_dir, 'logo-mark.png'), 'PNG')
cropped_emblem.save(os.path.join(assets_dir, 'logo-mark.png'), 'PNG')

# Save cut-out full logo (transparent PNG)
print("4. Saving transparent logo.png...")
cropped_full.save(os.path.join(public_dir, 'logo.png'), 'PNG')
cropped_full.save(os.path.join(assets_dir, 'logo.png'), 'PNG')

def center_in_square(img, target_size, scale_factor=0.90):
    canvas = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    w, h = img.size
    max_dim = int(target_size * scale_factor)
    if w >= h:
        new_w = max_dim
        new_h = int(h * (max_dim / w))
    else:
        new_h = max_dim
        new_w = int(w * (max_dim / h))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas

print("5. Generating transparent PWA & launcher icons...")
square_1024 = center_in_square(cropped_emblem, 1024, 0.90)
square_1024.save(os.path.join(public_dir, 'logo-square.png'), 'PNG')

icon_512 = center_in_square(cropped_emblem, 512, 0.90)
icon_512.save(os.path.join(public_dir, 'icon-512.png'), 'PNG')
icon_512.save(os.path.join(public_dir, 'icon-maskable-512.png'), 'PNG')

icon_192 = center_in_square(cropped_emblem, 192, 0.90)
icon_192.save(os.path.join(public_dir, 'icon-192.png'), 'PNG')
icon_192.save(os.path.join(public_dir, 'icon-maskable-192.png'), 'PNG')

apple_icon = center_in_square(cropped_emblem, 180, 0.90)
apple_icon.save(os.path.join(public_dir, 'apple-touch-icon.png'), 'PNG')

fav_32 = center_in_square(cropped_emblem, 32, 0.92)
fav_32.save(os.path.join(public_dir, 'favicon-32.png'), 'PNG')

fav_16 = center_in_square(cropped_emblem, 16, 0.92)
fav_16.save(os.path.join(public_dir, 'favicon-16.png'), 'PNG')

fav_32.save(os.path.join(public_dir, 'favicon.ico'), format='ICO', sizes=[(32, 32)])

print("6. Generating vector SVG wrappers with embedded transparent cutout...")
import io
buf = io.BytesIO()
fav_256 = center_in_square(cropped_emblem, 256, 0.90)
fav_256.save(buf, format='PNG')
b64_str = base64.b64encode(buf.getvalue()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,{b64_str}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>'''

with open(os.path.join(public_dir, 'icon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)
with open(os.path.join(public_dir, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)

print("ALL BRAND ASSETS SUCCESSFULLY REGENERATED WITH 100% TRANSPARENT CUTOUTS!")
