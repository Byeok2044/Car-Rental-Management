const URGENCY_URL = process.env.URGENCY_SERVICE_URL || 'http://localhost:5001';

export async function callClassifier(message, subject = '') {
    try {
        const res = await fetch(`${URGENCY_URL}/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, subject }),
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) throw new Error(`Classifier HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn(`[urgency] classifier unreachable: ${err.message} — defaulting to low`);
        return { urgency: 'low', score: 0, breakdown: {}, confidence: 'fallback' };
    }
}

export async function callBatchReclassify(messages) {
    const res = await fetch(`${URGENCY_URL}/reclassify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Reclassify HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
}