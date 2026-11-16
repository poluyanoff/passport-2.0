import {existsSync, readFileSync} from 'node:fs';

export function loadEnv() {
    const path = '.env';
    if (!existsSync(path)) return;

    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || Object.hasOwn(process.env, match[1])) continue;
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}
