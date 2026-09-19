import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const seconds = Number(process.argv[2] ?? 600);
if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Expected a positive duration in seconds');
const input = fileURLToPath(new URL('../public/audio/voiceover.wav', import.meta.url));
const output = fileURLToPath(new URL('../public/audio/export-fixture.wav', import.meta.url));
const args = ['-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', input,
  '-f', 'lavfi', '-i', `sine=frequency=1500:sample_rate=48000:duration=${seconds}`,
  '-filter_complex', "[0:a]aresample=48000,volume=0.6[a];[1:a]volume='if(lt(mod(t,10),0.1),0.3,0)':eval=frame[b];[a][b]amix=inputs=2:normalize=0[out]",
  '-map', '[out]', '-t', String(seconds), '-c:a', 'pcm_s16le', '-y', output];
const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`${seconds}s fixture ready: ${output}`);
