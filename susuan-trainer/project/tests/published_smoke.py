"""Verify actual public Pages bytes with the environment's configured TLS trust.

Runtime interactions and offline flows are covered by browser_test.py. This check
verifies that every deployed asset is the exact build that passed those flows.
"""
import hashlib
import json
import os
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('PUBLISHED_URL', 'https://ayden96718-rgb.github.io/notion-countdown/susuan-trainer/')
CA = os.environ.get('SSL_CERT_FILE')
trust = ssl.create_default_context(cafile=CA)
checks = []
assets = []
for file in sorted((ROOT/'dist').rglob('*')):
    if not file.is_file() or file.name == '.nojekyll':
        continue
    relative = file.relative_to(ROOT/'dist').as_posix()
    with urlopen(URL+relative, context=trust, timeout=30) as response:
        assert response.status == 200, (relative, response.status)
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == hashlib.sha256(file.read_bytes()).hexdigest(), relative
    assets.append({'path': relative, 'status': 200, 'sha256': digest, 'bytes': len(data)})
checks.append(f'{len(assets)} public site assets return HTTP 200 and exactly match the tested build')
with urlopen(URL, context=trust, timeout=30) as response:
    assert response.status == 200
    assert response.read() == (ROOT/'dist/index.html').read_bytes()
checks.append('public directory URL returns the exact tested homepage')
old_url = 'https://ayden96718-rgb.github.io/notion-countdown/'
with urlopen(old_url, context=trust, timeout=30) as response:
    assert response.status == 200
    old = response.read()
blob = hashlib.sha1(b'blob '+str(len(old)).encode()+b'\0'+old).hexdigest()
assert blob == '1881683bbb6ba7665c3cb78bef9097a1a296a1b4', blob
checks.append('original countdown homepage still returns its unchanged Git blob')
result = {
    'url': URL, 'verified_at_utc': datetime.now(timezone.utc).isoformat(),
    'status': 'passed', 'tls_verification': 'enabled, configured system CA bundle',
    'checks': checks, 'assets': assets, 'original_homepage_blob': blob,
    'browser_runtime_evidence': 'browser-results.json: 13 local Chromium/WebKit checks against identical build assets',
    'cloud_live_browser_limitation': 'Cloud Chromium does not trust the environment proxy CA. No trust-store changes or certificate-validation disabling used.'
}
(ROOT/'docs/evidence/published-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'url': URL, 'status': 'passed', 'checks': checks}, ensure_ascii=False, indent=2))
