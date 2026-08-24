
import fetch from 'node-fetch';
import fs from 'fs';

const evoUrl = 'http://77.37.43.60:8080';
const key = 'EvolutionPandaSecret123';
const acrilightInst = 'conn_60323974-89c5-4120-a7a1-9c8774e24ed8';
const pixelInst = 'conn_271ca3fd-3bc2-4f68-8da5-b4de56132588';

async function checkWebhooks() {
    let output = `--- WEBHOOK INSPECTION ---\n\n`;

    for (const inst of [acrilightInst, pixelInst]) {
        try {
            const webhookReq = await fetch(`${evoUrl}/webhook/find/${inst}`, {
                headers: { 'apikey': key }
            });
            const webhooks = await webhookReq.json();
            output += `--- WEBHOOKS for ${inst} ---\n${JSON.stringify(webhooks, null, 2)}\n\n`;
        } catch (e) {
            output += `ERROR for ${inst}: ${e.message}\n\n`;
        }
    }

    fs.writeFileSync('webhook_check_results.txt', output);
    console.log("Check complete.");
}

checkWebhooks();
