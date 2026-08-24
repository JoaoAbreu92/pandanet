
import fetch from 'node-fetch';
import fs from 'fs';

const evoUrl = 'http://77.37.43.60:8080';
const key = 'EvolutionPandaSecret123';

const ACRILIGHT_COMPANY = '6323c46c-f0d1-49af-886a-912efb3c6f41';
const ACRILIGHT_CONN = '60323974-89c5-4120-a7a1-9c8774e24ed8';
const ACRILIGHT_INST = `conn_${ACRILIGHT_CONN}`;

const PIXEL_COMPANY = '56eaa5ed-8d1b-4879-a002-838702eeb14d';
const PIXEL_CONN = '271ca3fd-3bc2-4f68-8da5-b4de56132588';
const PIXEL_INST = `conn_${PIXEL_CONN}`;

const backendUrl = 'http://whatsapp-backend:3000';

async function repair() {
    let output = `--- WEBHOOK REPAIR LOG ---\n\n`;

    const targets = [
        { inst: ACRILIGHT_INST, company: ACRILIGHT_COMPANY, conn: ACRILIGHT_CONN },
        { inst: PIXEL_INST, company: PIXEL_COMPANY, conn: PIXEL_CONN }
    ];

    for (const t of targets) {
        const webhookUrl = `${backendUrl}/webhook/evolution/${t.company}/${t.conn}`;
        output += `REPAIRING ${t.inst} -> ${webhookUrl}\n`;
        
        try {
            const res = await fetch(`${evoUrl}/webhook/set/${t.inst}`, {
                method: 'POST',
                headers: { 'apikey': key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: true,
                    url: webhookUrl,
                    events: [
                        'QRCODE_UPDATED',
                        'MESSAGES_UPSERT',
                        'MESSAGES_UPDATE',
                        'MESSAGES_DELETE',
                        'SEND_MESSAGE',
                        'CONNECTION_UPDATE',
                        'CHATS_UPSERT',
                        'CHATS_UPDATE'
                    ]
                })
            });
            const data = await res.json();
            output += `RESULT: ${JSON.stringify(data, null, 2)}\n\n`;
        } catch (e) {
            output += `ERROR: ${e.message}\n\n`;
        }
    }

    fs.writeFileSync('repair_webhooks_results.txt', output);
    console.log("Repair complete.");
}

repair();
