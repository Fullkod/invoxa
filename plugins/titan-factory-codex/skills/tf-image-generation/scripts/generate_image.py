"""Generate an image using a user-selected OpenRouter model. Requires environment credentials."""
import argparse
import base64
import binascii
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

TYPES = {'image/png': {'.png'}, 'image/jpeg': {'.jpg', '.jpeg'}, 'image/webp': {'.webp'}}


def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    raise ValueError('Unsupported or invalid image bytes.')


def decode_image(payload):
    try:
        message = payload['choices'][0]['message']
    except (KeyError, IndexError, TypeError):
        raise ValueError('Provider returned no image message.') from None
    if not isinstance(message, dict):
        raise ValueError('Provider returned an invalid image message.')
    parts = message.get('images', [])
    if not isinstance(parts, list):
        raise ValueError('Provider returned an invalid images list.')
    content = message.get('content')
    if isinstance(content, list):
        parts = parts + content
    elif isinstance(content, str) and content.startswith('data:image/'):
        parts = parts + [{'image_url': {'url': content}}]
    for part in parts:
        reference = part.get('image_url', {}) if isinstance(part, dict) else {}
        url = reference.get('url', '') if isinstance(reference, dict) else ''
        if not isinstance(url, str):
            continue
        match = re.fullmatch(r'data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)', url)
        if not match:
            continue
        try:
            data = base64.b64decode(re.sub(r'\s', '', match[2]), validate=True)
        except binascii.Error:
            raise ValueError('Invalid base64 image data.') from None
        if image_type(data) != match[1]:
            raise ValueError('Returned image MIME does not match its bytes.')
        return match[1], data
    raise ValueError('No supported inline image returned. Remote URLs are not decoded as base64.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prompt-file', type=Path, required=True)
    parser.add_argument('--model', required=True, help='Explicit current provider model ID.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--image', type=Path)
    parser.add_argument('--aspect', default='1:1')
    parser.add_argument('--timeout', type=float, default=120)
    args = parser.parse_args()
    try:
        if args.output.exists():
            raise ValueError('Output already exists; choose a new filename.')
        if args.output.suffix.lower() not in set.union(*TYPES.values()):
            raise ValueError('Output extension must be png, jpg, jpeg or webp.')
        if args.timeout <= 0:
            raise ValueError('Timeout must be positive.')
        key = os.environ.get('OPENROUTER_API_KEY', '').strip()
        if not key:
            raise ValueError('Set OPENROUTER_API_KEY in the process environment.')
        prompt = args.prompt_file.read_text(encoding='utf-8').strip()
        if not prompt:
            raise ValueError('Prompt file is empty.')
        content = [{'type': 'text', 'text': prompt + '\nRequested aspect ratio: ' + args.aspect}]
        if args.image:
            data = args.image.read_bytes()
            mime = image_type(data)
            content.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,' + base64.b64encode(data).decode()}})
        body = {'model': args.model, 'messages': [{'role': 'user', 'content': content}], 'modalities': ['image', 'text']}
        req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        opener = urllib.request.build_opener(NoRedirect)
        with opener.open(req, timeout=args.timeout) as response:
            payload = json.load(response)
        mime, data = decode_image(payload)
        if args.output.suffix.lower() not in TYPES[mime]:
            raise ValueError(f'Provider returned {mime}; use its matching extension. No mislabeled file was written.')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as handle:
            handle.write(data)
        print(json.dumps({'output': str(args.output.resolve()), 'mime_type': mime, 'bytes': len(data)}))
        return 0
    except urllib.error.HTTPError as exc:
        print(f'Provider HTTP error {exc.code}; response body omitted.', file=sys.stderr)
    except (OSError, ValueError, urllib.error.URLError) as exc:
        print(f'Image generation failed: {type(exc).__name__}. Check inputs, environment, network and provider model.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
