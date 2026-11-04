"""Call a configured Tasknic JSON API. Mutations require --apply and user authorization."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request


def endpoint(base, relative):
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('TASKNIC_API_URL must be an HTTPS base URL without credentials, query or fragment.')
    rel = urllib.parse.urlsplit(relative)
    decoded = urllib.parse.unquote(relative)
    if rel.scheme or rel.netloc or rel.fragment or decoded.startswith('//') or '\\' in decoded or '..' in decoded.split('/') or any(ord(c) < 32 for c in decoded):
        raise ValueError('Provide a relative API path without traversal, fragments or control characters.')
    return base.rstrip('/') + '/' + relative.lstrip('/')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--method', choices=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], default='GET')
    parser.add_argument('--path', default='/')
    parser.add_argument('--body-file', type=Path, help='UTF-8 JSON file; values never interpolated into a shell command.')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--timeout', type=float, default=30)
    args = parser.parse_args()
    try:
        url = endpoint(os.environ.get('TASKNIC_API_URL', ''), args.path)
        if args.timeout <= 0:
            raise ValueError('Timeout must be positive.')
        data = None
        if args.body_file:
            data = json.dumps(json.loads(args.body_file.read_text(encoding='utf-8'))).encode()
        if args.method == 'GET' and data is not None:
            raise ValueError('GET does not accept a JSON body.')
        if args.method != 'GET' and not args.apply:
            print(json.dumps({'method': args.method, 'path': args.path, 'applied': False, 'body_supplied': data is not None}))
            return 0
        key = os.environ.get('TASKNIC_API_KEY', '').strip()
        if not key:
            raise ValueError('Set TASKNIC_API_KEY in the environment.')
        req = urllib.request.Request(url, data=data, method=args.method, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(req, timeout=args.timeout) as response:
            raw = response.read()
            result = json.loads(raw) if raw else {'status': response.status}
        print(json.dumps(result, ensure_ascii=True, indent=2))
        return 0
    except urllib.error.HTTPError as exc:
        print(f'Tasknic HTTP error {exc.code}; response body omitted. Do not blindly retry mutations.', file=sys.stderr)
    except (ValueError, OSError, urllib.error.URLError) as exc:
        print(f'Tasknic request failed: {type(exc).__name__}. Check configuration, path and JSON input.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
