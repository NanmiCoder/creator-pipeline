"""Personal voice preferences live outside the installed skill and public repository."""
import json
import os
from pathlib import Path
from providers import auto_provider, local_provider

PROVIDERS = ('local', 'minimax', 'mlx', 'qwen', 'nano')
FIELDS = ('provider', 'voice', 'reference', 'reference_text')


def config_path():
    return Path(os.environ.get('CREATOR_TTS_CONFIG', Path.home() / '.config/creator-pipeline/voice.json'))


def load_config():
    path = config_path()
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or any(k not in FIELDS for k in data):
        raise ValueError('Voice preferences support provider, voice, reference and reference_text only; keep API keys in mmx.')
    if any(not isinstance(v, str) or not v.strip() for v in data.values()):
        raise ValueError('Voice preferences must be non-empty strings')
    if data.get('provider') and data['provider'] not in PROVIDERS:
        raise ValueError('Unknown provider in voice preferences')
    return data


def configured_provider(requested=None, config=None):
    config = load_config() if config is None else config
    selected = requested if requested not in (None, 'auto') else os.environ.get('CREATOR_TTS_PROVIDER') or config.get('provider')
    if selected is None or selected == 'auto':
        return auto_provider()
    if selected not in PROVIDERS:
        raise ValueError('Unknown CREATOR_TTS_PROVIDER or voice provider')
    return local_provider() if selected == 'local' else selected
