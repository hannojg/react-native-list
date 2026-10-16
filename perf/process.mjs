import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

export async function command(executable, args, { cwd, env, log, capture = false, signal, trim = true } = {}) {
  const child = spawn(executable, args, {
    cwd, env: { ...process.env, ...env }, signal,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stream = log ? createWriteStream(log, { flags: 'a' }) : null;
  const chunks = [];
  child.stdout.on('data', (chunk) => {
    if (capture) chunks.push(chunk);
    if (stream) stream.write(chunk);
    else if (capture === false) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    if (stream) stream.write(chunk);
    else process.stderr.write(chunk);
  });
  try {
    const [code, killedBy] = await once(child, 'close');
    if (code !== 0) {
      const details = log ? ` See ${log}` : '';
      throw new Error(`${executable} failed (${killedBy ?? code}).${details}`);
    }
    const output = Buffer.concat(chunks);
    const text = output.toString('utf8');
    return trim ? text.trim() : text;
  } finally {
    if (stream) {
      stream.end();
      await once(stream, 'finish');
    }
  }
}

export async function jsonCommand(executable, args, options) {
  const text = await command(executable, args, { ...options, capture: true });
  return JSON.parse(text);
}
