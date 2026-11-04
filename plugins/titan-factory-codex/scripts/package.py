"""Build a local plugin ZIP without dependencies, caches, credentials or project state."""
import argparse
import json
from pathlib import Path
import zipfile
from titan import ROOT, source_files
from validate import validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='New ZIP path; existing files are never replaced.')
    args = parser.parse_args()
    result = validate()
    if result['errors']:
        print(json.dumps(result, indent=2))
        return 1
    version = json.loads((ROOT / '.codex-plugin/plugin.json').read_text())['version']
    output = args.output or ROOT / 'dist' / f'titan-factory-codex-{version}.zip'
    if output.exists():
        parser.error('Output exists; choose a new filename.')
    output.parent.mkdir(parents=True, exist_ok=True)
    files = source_files()
    for path in (ROOT / 'tests').glob('*.py'):
        files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(name, data)
    print(json.dumps({'archive': str(output.resolve()), 'files': len(files), 'bytes': output.stat().st_size}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
