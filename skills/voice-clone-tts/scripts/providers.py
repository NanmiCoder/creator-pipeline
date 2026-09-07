"""Optional model backends. Imported lazily; no provider silently falls back to cloud."""
import os
import platform
import subprocess
from pathlib import Path

MODELS = {
    'nano': 'OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX',
    'mlx': 'mlx-community/Qwen3-TTS-12Hz-0.6B-Base-4bit',
    'qwen': 'Qwen/Qwen3-TTS-12Hz-0.6B-Base',
    'minimax': 'speech-2.8-hd',
}
NANO_COMMIT = '8b7bcc9341b3b4ef3a3a58ba1338a7d85ff133eb'
REVISIONS = {
    'nano': 'f52645cb467506d8e18e746ddd59482685b74e58',
    'mlx': '0d6bb6fe33f92d47a507e23b9148940e8366ab5b',
    'qwen': '5d83992436eae1d760afd27aff78a71d676296fc',
}
NANO_TOKENIZER_REVISION = 'ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae'


def auto_provider():
    """Qwen3-TTS everywhere; use its MLX implementation on Apple Silicon."""
    return 'mlx' if platform.system() == 'Darwin' and platform.machine() == 'arm64' else 'qwen'


class Nano:
    def __init__(self, settings, reference, ref_text):
        import torch
        from huggingface_hub import snapshot_download
        from onnx_tts_runtime import OnnxTtsRuntime
        torch.set_num_threads(settings['threads'])
        root = Path(os.environ.get('CREATOR_MODEL_DIR', Path.home() / '.cache' / 'creator-pipeline' / 'models'))
        if settings['model'] != MODELS['nano']:
            root = Path(settings['model'])  # Local root containing the two named ONNX model folders.
            if not root.is_dir():
                raise ValueError('nano --model must be a local root containing both ONNX model folders')
        else:
            for repo, rev in [(MODELS['nano'], REVISIONS['nano']),
                             ('OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX', NANO_TOKENIZER_REVISION)]:
                snapshot_download(repo, revision=rev, local_dir=root / repo.split('/')[-1],
                    allow_patterns=['*.onnx', '*.data', '*.json', 'tokenizer.model'], max_workers=2)
        class CachedReference(OnnxTtsRuntime):
            def resolve_prompt_audio_codes(self, **kwargs):
                if kwargs.get('prompt_audio_path') == self.reference_path:
                    return self.reference_codes
                return super().resolve_prompt_audio_codes(**kwargs)
        self.runtime = CachedReference(model_dir=root, thread_count=settings['threads'],
            max_new_frames=settings['max_tokens'], execution_provider='cpu', output_dir=reference.parent)
        self.runtime.reference_path = str(reference)
        self.runtime.reference_codes = self.runtime.encode_reference_audio(str(reference))
        self.settings, self.ref_text = settings, ref_text or ''

    def generate(self, text, dest, seed):
        import numpy as np
        r = self.runtime.synthesize(text=text, prompt_audio_path=self.runtime.reference_path,
            output_audio_path=dest, streaming=False,
            max_new_frames=self.settings['max_tokens'], enable_wetext=False,
            enable_normalize_tts_text=False, seed=seed)
        if not np.isfinite(r['waveform']).all() or len(r['audio_token_ids']) >= self.settings['max_tokens']:
            raise ValueError('Invalid or capped generation; shorten segment or inspect and retry')


def save_float(path, data, rate):
    import numpy as np
    import wave
    x = np.asarray(data, dtype=np.float32).reshape(-1)
    if not len(x) or not np.isfinite(x).all():
        raise ValueError('Model returned empty or non-finite samples')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


class MLX:
    def __init__(self, settings, reference, ref_text):
        from mlx_audio.tts.utils import load_model
        from huggingface_hub import snapshot_download
        model = settings['model']
        if model == MODELS['mlx']:
            model = snapshot_download(model, revision=REVISIONS['mlx'], max_workers=2)
        self.model = load_model(model)
        self.settings, self.reference, self.ref_text = settings, reference, ref_text

    def generate(self, text, dest, seed):
        import mlx.core as mx
        import numpy as np
        mx.random.seed(seed)
        pieces = []
        for result in self.model.generate(text=text, ref_audio=str(self.reference), ref_text=self.ref_text,
                lang_code=self.settings['language'].lower(), temperature=self.settings['temperature'],
                max_tokens=self.settings['max_tokens'], split_pattern=None, verbose=False):
            pieces.append(np.asarray(result.audio, dtype=np.float32))
            rate = result.sample_rate
        if not pieces:
            raise ValueError('No audio returned')
        save_float(dest, np.concatenate(pieces), rate)


class Qwen:
    def __init__(self, settings, reference, ref_text):
        import torch
        from qwen_tts import Qwen3TTSModel
        self.settings = settings
        device = settings['device']
        if device == 'auto':
            device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        self.model = Qwen3TTSModel.from_pretrained(settings['model'], device_map=device,
            dtype=torch.float32 if device == 'cpu' else torch.float16, attn_implementation='sdpa',
            revision=REVISIONS['qwen'] if settings['model'] == MODELS['qwen'] else None)
        self.prompt = self.model.create_voice_clone_prompt(ref_audio=str(reference),
            ref_text=ref_text, x_vector_only_mode=not bool(ref_text))

    def generate(self, text, dest, seed):
        import torch
        torch.manual_seed(seed)
        waves, rate = self.model.generate_voice_clone(text=text, language=self.settings['language'],
            voice_clone_prompt=self.prompt, temperature=self.settings['temperature'],
            max_new_tokens=self.settings['max_tokens'])
        save_float(dest, waves[0], rate)


class MiniMax:
    def __init__(self, settings, reference, ref_text):
        self.settings = settings

    def generate(self, text, dest, seed):
        # Credentials remain in the caller's environment/mmx keychain, never in a manifest.
        s = self.settings
        subprocess.run(['mmx', 'speech', 'synthesize', '--text', text, '--voice', s['voice'],
            '--model', s['model'], '--format', 'wav', '--sample-rate', str(s['sample_rate']),
            '--channels', '1', '--out', str(dest), '--non-interactive', '--quiet'], check=True,
            timeout=180, stdout=subprocess.DEVNULL)


BACKENDS = {'nano': Nano, 'mlx': MLX, 'qwen': Qwen, 'minimax': MiniMax}
