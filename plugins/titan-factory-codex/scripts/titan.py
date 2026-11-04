"""Portable Titan toolkit lifecycle. Preview by default; no recursive removal."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = '.titan-toolkit-manifest.json'
BEGIN = '<!-- titan-factory-codex:start -->'
END = '<!-- titan-factory-codex:end -->'
BLOCK = f'''{BEGIN}
## Titan Factory Codex

- At the start of a relevant project task, read `.titan/memory/MEMORY.md` if present and only its relevant linked entries.
- Use available `tf-` skills for matching work. Skills do not imply connected services or permission for unrelated actions.
- For new compatible apps prefer Next.js + Supabase + Vercel. EasyPanel remains an alternative. Preserve this project's existing stack and the user's explicit choices.
- Keep project decisions in `.titan/memory/`, feature plans in `.titan/plans/` and useful QA evidence in `.titan/qa/`. Read-only tasks must not write state.
- Reuse authorization already given for the task. Delegate only when the user requests or authorizes delegation; do not launch agents merely because role files exist.
- Preserve local code and project knowledge during toolkit updates. Never store credentials in shared memory.
{END}'''


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checked_root(value: str | Path) -> Path:
    raw = Path(value).expanduser().absolute()
    for part in [raw, *raw.parents]:
        if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
            raise ValueError(f'Linked path is not a supported write target: {part}')
    path = raw.resolve()
    if path == Path(path.anchor) or path == Path.home().resolve():
        raise ValueError('Select a dedicated directory, not a drive root or home directory.')
    if path.exists() and not path.is_dir():
        raise ValueError(f'Not a directory: {path}')
    return path


def child(root: Path, relative: str) -> Path:
    rel = PurePosixPath(relative)
    if not relative or rel.is_absolute() or any(p in ('..', '.') for p in rel.parts) or '\\' in relative or ':' in relative:
        raise ValueError(f'Invalid relative path: {relative}')
    path = root.joinpath(*rel.parts)
    if not path.resolve().is_relative_to(root):
        raise ValueError(f'Path escapes target: {relative}')
    for part in [path, *path.parents]:
        if part == root.parent:
            break
        if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
            raise ValueError(f'Linked path rejected: {relative}')
        if part != path and part.exists() and not part.is_dir():
            raise ValueError(f'Parent is not a directory: {part}')
    if path.exists() and not path.is_file():
        raise ValueError(f'Target is not a regular file: {relative}')
    return path


def read_manifest(target: Path) -> dict:
    path = child(target, MANIFEST)
    if not path.exists():
        return {'schema': 1, 'files': {}}
    result = json.loads(path.read_text(encoding='utf-8'))
    if result.get('schema') != 1 or not isinstance(result.get('files'), dict):
        raise ValueError('Unsupported ownership manifest.')
    if result.get('target') != str(target):
        raise ValueError('Ownership manifest belongs to a different installation path.')
    for relative, expected in result['files'].items():
        child(target, relative)
        if relative == MANIFEST or relative.startswith('.titan-toolkit-'):
            raise ValueError('Manifest cannot own lifecycle metadata.')
        if not isinstance(expected, str) or len(expected) != 64:
            raise ValueError('Invalid ownership checksum.')
    return result


def source_files() -> dict[str, bytes]:
    result = {}
    folders = ['.codex-plugin', 'skills', 'agents', 'design-systems', 'templates', 'scripts', 'docs']
    for folder in folders:
        for path in (ROOT / folder).rglob('*'):
            if not path.is_file() or any(p in ('__pycache__', 'node_modules', '.next', '.venv') for p in path.parts):
                continue
            if path.suffix in ('.pyc', '.tsbuildinfo', '.pem', '.key'):
                continue
            if path.name.startswith('.env') and not path.name.endswith('.example'):
                continue
            if path.is_symlink():
                raise ValueError('Source contains a linked file.')
            result[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    for name in ['README.md', 'AGENTS.md', 'NOTICE.md', 'CHANGELOG.md', '.gitignore']:
        if (ROOT / name).is_file():
            result[name] = (ROOT / name).read_bytes()
    return result


def apply_changes(root: Path, changes: dict[str, bytes | None], expected: dict[str, str | None]) -> str:
    # Preflight everything before changing anything. The lock serializes toolkit runs.
    for relative in changes:
        path = child(root, relative)
        actual = digest(path.read_bytes()) if path.exists() else None
        if actual != expected[relative]:
            raise ValueError(f'File changed since preview: {relative}')
    root.mkdir(parents=True, exist_ok=True)
    lock = child(root, '.titan-toolkit-lock')
    backup_id = uuid.uuid4().hex
    with lock.open('x', encoding='utf-8') as handle:
        handle.write(str(os.getpid()))
    try:
        for relative in changes:
            path = child(root, relative)
            actual = digest(path.read_bytes()) if path.exists() else None
            if actual != expected[relative]:
                raise ValueError(f'Concurrent edit detected: {relative}')
        for relative, data in changes.items():
            path = child(root, relative)
            if path.exists():
                backup = child(root, f'.titan-toolkit-backups/{backup_id}/{relative}')
                backup.parent.mkdir(parents=True, exist_ok=True)
                with backup.open('xb') as handle:
                    handle.write(path.read_bytes())
            if data is None:
                path.unlink()
            elif path.exists():
                temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
                try:
                    with temporary.open('xb') as handle:
                        handle.write(data)
                    os.replace(temporary, path)
                finally:
                    if temporary.exists():
                        temporary.unlink()
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as handle:
                    handle.write(data)
    finally:
        lock.unlink()
    return backup_id


def sync_toolkit(target: Path, apply: bool, eject: bool = False) -> dict:
    if target == ROOT or target.is_relative_to(ROOT) or ROOT.is_relative_to(target):
        raise ValueError('Installation must be separate from the source tree.')
    if target.name != 'titan-factory-codex':
        raise ValueError('Use a dedicated folder named titan-factory-codex to match the plugin manifest.')
    old = read_manifest(target)
    if eject and not (target / MANIFEST).exists():
        raise ValueError('No ownership manifest; refusing to infer owned files.')
    if not (target / MANIFEST).exists() and any((target / f).exists() for f in ('package.json', '.git', 'AGENTS.md')):
        raise ValueError('Use a dedicated toolkit directory, not an application or repository root.')
    incoming = {} if eject else source_files()
    changes, expected, conflicts, preserved = {}, {}, [], []
    owned = dict(old['files'])
    for relative in sorted(set(incoming) | set(owned)):
        path = child(target, relative)
        actual = digest(path.read_bytes()) if path.exists() else None
        previous = owned.get(relative)
        if eject:
            if actual == previous:
                changes[relative], expected[relative] = None, actual
                owned.pop(relative)
            elif actual is None:
                owned.pop(relative)
            else:
                preserved.append(relative)
        elif relative not in incoming:
            preserved.append(relative)
        elif actual is not None and (previous is None or actual != previous):
            conflicts.append(relative)
        else:
            data = incoming[relative]
            if actual != digest(data):
                changes[relative], expected[relative] = data, actual
            owned[relative] = digest(data)
    result = {'mode': 'eject' if eject else 'install/update', 'target': str(target), 'changes': list(changes), 'conflicts': conflicts, 'preserved': preserved, 'applied': False}
    if conflicts:
        return result
    version = json.loads((ROOT / '.codex-plugin/plugin.json').read_text(encoding='utf-8'))['version']
    manifest = {'schema': 1, 'target': str(target), 'version': version, 'files': owned}
    data = (json.dumps(manifest, indent=2) + '\n').encode()
    mp = child(target, MANIFEST)
    if not mp.exists() or mp.read_bytes() != data:
        changes[MANIFEST] = data
        expected[MANIFEST] = digest(mp.read_bytes()) if mp.exists() else None
    if apply and changes:
        result['backup_id'] = apply_changes(target, changes, expected)
        result['applied'] = True
    return result


def replace_block(text: str, block: str | None) -> str:
    starts, ends = text.count(BEGIN), text.count(END)
    if starts != ends or starts > 1:
        raise ValueError('Ambiguous Titan markers in AGENTS.md; reconcile manually.')
    if starts:
        start, end = text.index(BEGIN), text.index(END)
        if end < start:
            raise ValueError('Invalid Titan marker order.')
        return text[:start] + (block or '') + text[end + len(END):]
    return text + ('\n\n' if text and not text.endswith('\n\n') else '') + block + '\n' if block else text


def project_files(project: Path, apply: bool, agents: bool = False, detach: bool = False) -> dict:
    if not project.is_dir():
        raise ValueError('Project must already exist; scaffold-app creates new applications.')
    if project == ROOT or ROOT.is_relative_to(project):
        raise ValueError('Choose a target application, not the toolkit source or its ancestor.')
    ap = child(project, 'AGENTS.md')
    old = ap.read_bytes() if ap.exists() else b''
    text = old.decode('utf-8-sig')
    # Initialization preserves an existing block, including project-specific edits.
    if not detach and BEGIN in text:
        replace_block(text, BLOCK)  # validate markers only
        updated = old
    else:
        updated = replace_block(text, None if detach else BLOCK).encode('utf-8')
    changes, expected, preserved = {}, {}, []
    if updated != old:
        changes['AGENTS.md'], expected['AGENTS.md'] = updated, digest(old) if ap.exists() else None
    candidates = {}
    if not detach:
        candidates['.titan/project.json'] = (json.dumps({'schema': 1, 'preferred_stack': ['Next.js', 'Supabase', 'Vercel'], 'alternative_deploy': 'EasyPanel'}, indent=2) + '\n').encode()
        candidates['.titan/memory/MEMORY.md'] = b'# Project memory\n\nRead relevant entries only. Store decisions with dates and evidence.\n\n## User and team\n\n## Feedback\n\n## Project decisions\n\n## References\n'
        for folder in ('memory/user', 'memory/feedback', 'memory/project', 'memory/reference', 'plans', 'qa'):
            candidates[f'.titan/{folder}/.gitkeep'] = b''
        if agents:
            for path in (ROOT / 'agents').glob('*.toml'):
                candidates['.codex/agents/' + path.name] = path.read_bytes()
    for relative, data in candidates.items():
        path = child(project, relative)
        if path.exists():
            preserved.append(relative)
        else:
            changes[relative], expected[relative] = data, None
    result = {'target': str(project), 'changes': list(changes), 'preserved': preserved, 'applied': False}
    if apply and changes:
        result['backup_id'] = apply_changes(project, changes, expected)
        result['applied'] = True
    return result


def scaffold(target: Path, apply: bool) -> dict:
    if target.exists() and any(target.iterdir()):
        raise ValueError('Application target must be new or empty.')
    source = ROOT / 'templates/nextjs-supabase'
    files = {p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file() and not any(x in p.parts for x in ('node_modules', '.next', '__pycache__')) and p.suffix != '.tsbuildinfo'}
    result = {'target': str(target), 'changes': sorted(files), 'applied': False}
    if apply:
        apply_changes(target, files, dict.fromkeys(files))
        result['applied'] = True
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('install-toolkit', 'eject-toolkit', 'scaffold-app'):
        p = sub.add_parser(command)
        p.add_argument('--target', required=True)
        p.add_argument('--apply', action='store_true', help='Apply the previewed scope; default is read-only.')
    for command in ('init-project', 'detach-project'):
        p = sub.add_parser(command)
        p.add_argument('--project', required=True)
        p.add_argument('--apply', action='store_true')
        if command == 'init-project':
            p.add_argument('--agents', action='store_true', help='Add the seven native agent files without overwriting existing ones.')
    args = parser.parse_args()
    try:
        if args.command in ('init-project', 'detach-project'):
            result = project_files(checked_root(args.project), args.apply, getattr(args, 'agents', False), args.command == 'detach-project')
        elif args.command == 'scaffold-app':
            result = scaffold(checked_root(args.target), args.apply)
        else:
            result = sync_toolkit(checked_root(args.target), args.apply, args.command == 'eject-toolkit')
        print(json.dumps(result, indent=2))
        return 2 if result.get('conflicts') else 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
