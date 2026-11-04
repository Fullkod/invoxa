"""Validate Titan package integrity without third-party dependencies."""
import json
from pathlib import Path
import re
import sys
import tomllib
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


def validate(root=ROOT):
    errors = []
    manifest = json.loads((root / '.codex-plugin/plugin.json').read_text(encoding='utf-8'))
    if manifest['name'] != root.name:
        errors.append('Plugin name must match its root folder.')
    skills = sorted((root / 'skills').glob('*/SKILL.md'))
    migration = json.loads((root / 'docs/migration-manifest.json').read_text(encoding='utf-8'))
    expected = {x['skill'] for x in migration['skills']}
    if {p.parent.name for p in skills} != expected:
        errors.append('Skill entrypoints differ from the migration inventory.')
    for path in skills:
        text = path.read_text(encoding='utf-8')
        match = re.match(r'^---\n(.*?)\n---\n', text, re.S)
        if not match:
            errors.append(f'{path}: missing frontmatter')
            continue
        fields = {}
        for line in match[1].splitlines():
            key, sep, value = line.partition(': ')
            if not sep:
                errors.append(f'{path}: unsupported frontmatter line')
            fields[key] = value
        if set(fields) != {'name', 'description'} or fields.get('name') != path.parent.name:
            errors.append(f'{path}: inconsistent metadata')
        try:
            description = json.loads(fields.get('description', 'null'))
            if not isinstance(description, str) or not 1 <= len(description) <= 1024:
                errors.append(f'{path}: invalid description')
        except ValueError:
            errors.append(f'{path}: description must be a JSON-compatible YAML string')
        if len(text.splitlines()) > 150:
            errors.append(f'{path}: move extensive details into references')
        if re.search(r'\$ARGUMENTS|CLAUDE_SKILL_DIR|^context:|^allowed-tools:|^model:', text, re.M):
            errors.append(f'{path}: Claude runtime metadata remains')
    profiles = list((root / 'agents').glob('*.toml'))
    if len(profiles) != 7:
        errors.append('Expected all seven agent profiles.')
    for path in root.rglob('*.toml'):
        if any(p in ('.venv', 'node_modules', '.next') for p in path.parts):
            continue
        try:
            data = tomllib.loads(path.read_text(encoding='utf-8'))
            if path in profiles and not all(data.get(k) for k in ('name', 'description', 'developer_instructions')):
                errors.append(f'{path}: missing native agent fields')
        except ValueError as exc:
            errors.append(f'{path}: invalid TOML: {exc}')
    for path in root.rglob('*.md'):
        if any(p in ('.venv', '.verification', 'node_modules', '.next', '.git') for p in path.parts):
            continue
        text = path.read_text(encoding='utf-8')
        text = re.sub(r'(?ms)^```[^\n]*\n.*?^```[ \t]*$', '', text)
        # Inline Markdown syntax examples are documentation, not actual resource links.
        text = re.sub(r'`[^`\n]*`', '', text)
        for raw in re.findall(r'\[[^\]\n]+\]\(([^)\n]+)\)', text):
            link = raw.split('#', 1)[0]
            if not link or re.match(r'^[a-zA-Z]+:', link) or link.startswith(('$', '<')):
                continue
            target = (path.parent / unquote(link)).resolve()
            if not target.exists():
                errors.append(f'{path.relative_to(root)}: broken link {raw}')
    package = json.loads((root / 'templates/nextjs-supabase/package.json').read_text())
    if package['scripts'].get('typecheck') != 'tsc --noEmit' or package['scripts'].get('lint') != 'eslint .':
        errors.append('Starter validation scripts are inconsistent.')
    return {'skills': len(skills), 'agents': len(profiles), 'errors': errors}


if __name__ == '__main__':
    result = validate()
    print(json.dumps(result, indent=2))
    sys.exit(bool(result['errors']))
