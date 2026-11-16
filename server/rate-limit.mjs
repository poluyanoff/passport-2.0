const clients = new Map();

function numberFromEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function clientIp(req) {
    return req.socket.remoteAddress || 'unknown';
}

export function allowReview(ip, now = Date.now()) {
    const max = numberFromEnv('REVIEW_RATE_LIMIT_MAX', 20);
    const windowMs = numberFromEnv('REVIEW_RATE_LIMIT_WINDOW_MS', 60_000);
    const current = clients.get(ip);

    if (!current || now >= current.resetAt) {
        clients.set(ip, {count: 1, resetAt: now + windowMs});
        return {allowed: true, remaining: max - 1, retryAfter: 0};
    }
    if (current.count >= max) return {allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetAt - now) / 1000)};

    current.count += 1;
    return {allowed: true, remaining: max - current.count, retryAfter: 0};
}
