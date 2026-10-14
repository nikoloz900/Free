"""Fetch official Prisma engines without disabling TLS or checksum verification.

Some proxies reject the default Prisma fetch user agent. This helper uses the
same pinned engine commit and verifies both compressed and extracted artifacts.
"""
import gzip
import hashlib
import os
from pathlib import Path
import subprocess
import urllib.request

commit = subprocess.check_output(
    ['node', '-p', "require('@prisma/engines-version').enginesVersion"], text=True
).strip()
platform = subprocess.check_output(
    ['node', '-e', "require('@prisma/get-platform').getBinaryTargetForCurrentPlatform().then(p=>process.stdout.write(p))"], text=True
).strip()
if platform != 'debian-openssl-3.0.x':
    raise SystemExit('This cloud helper supports debian-openssl-3.0.x; use normal npm ci on other platforms.')
base = 'https://binaries.prisma.sh/all_commits/' + commit + '/' + platform + '/'
destination = Path('node_modules/@prisma/engines')

def fetch(path):
    request = urllib.request.Request(base + path, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()

for name, filename in [('schema-engine', 'schema-engine-' + platform),
                       ('libquery_engine.so.node', 'libquery_engine-' + platform + '.so.node')]:
    expected_compressed = fetch(name + '.gz.sha256').decode().split()[0]
    expected_raw = fetch(name + '.sha256').decode().split()[0]
    compressed = fetch(name + '.gz')
    if hashlib.sha256(compressed).hexdigest() != expected_compressed:
        raise SystemExit('Compressed engine SHA256 verification failed.')
    raw = gzip.decompress(compressed)
    if hashlib.sha256(raw).hexdigest() != expected_raw:
        raise SystemExit('Extracted engine SHA256 verification failed.')
    target = destination / filename
    temporary = target.with_suffix(target.suffix + '.download')
    temporary.write_bytes(raw)
    os.chmod(temporary, 0o755)
    temporary.replace(target)
    target.with_name(target.name + '.sha256').write_text(expected_raw)
    print(name + ': official download; compressed and extracted SHA256 verified')
