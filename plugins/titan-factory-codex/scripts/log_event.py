"""Append an explicit local event; this is not an automatically registered host hook."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from titan import checked_root, child


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('--event', required=True, help='Short non-sensitive event name, not full tool arguments.')
    parser.add_argument('--status', choices=['started', 'passed', 'failed', 'blocked'], required=True)
    args = parser.parse_args()
    root = checked_root(args.project)
    if not root.is_dir():
        parser.error('Project directory must exist.')
    path = child(root, '.titan/logs/events.jsonl')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps({'time': datetime.now(timezone.utc).isoformat(), 'event': args.event, 'status': args.status}) + '\n')
    print(str(path))


if __name__ == '__main__':
    main()
