import urllib.request
import re
import os

os.makedirs('src/lib/renderer/fonts/EBGaramond', exist_ok=True)

url = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
css = urllib.request.urlopen(req).read().decode('utf-8')

urls = re.findall(r'url\((https://[^)]+)\)', css)
font_names = ['EBGaramond-Italic', 'EBGaramond-BoldItalic', 'EBGaramond-Regular', 'EBGaramond-Bold']

for i, font_url in enumerate(urls):
    if i < len(font_names):
        print(f"Downloading {font_names[i]}...")
        urllib.request.urlretrieve(font_url, f'src/lib/renderer/fonts/EBGaramond/{font_names[i]}.ttf')

