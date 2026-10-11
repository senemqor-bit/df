"""mobile/index.html(Claude 아티팩트용)을 독립 웹앱(docs/)으로 만듭니다.

GitHub Pages 등에서 docs/ 폴더를 그대로 공개하면 Safari에서 바로 열리고,
'홈 화면에 추가'로 앱처럼 쓸 수 있습니다. Claude 없이 동작하며 설정은 기기에 저장됩니다.

사용: python3 mobile/build_app.py
"""
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'mobile' / 'index.html').read_text(encoding='utf-8')
out = ROOT / 'docs'
out.mkdir(exist_ok=True)

head = '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-title" content="인터벌">
<meta name="theme-color" content="#0b0d14">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<style>html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
'''
(out / 'index.html').write_text(head + src + '\n</body>\n</html>\n', encoding='utf-8')
shutil.copyfile(ROOT / 'mobile' / 'interval-ride-pip.mp4', out / 'interval-ride-pip.mp4')
(out / 'manifest.webmanifest').write_text('''{
  "name": "Interval Ride",
  "short_name": "인터벌",
  "start_url": "./",
  "display": "browser",
  "background_color": "#0b0d14",
  "theme_color": "#0b0d14",
  "icons": [
    { "src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
''', encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('built', out)
