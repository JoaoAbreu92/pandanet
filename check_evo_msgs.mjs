
import fetch from 'node-fetch';
import fs from 'fs';

const evoUrl = 'http://77.37.43.60:8080';
const key = 'EvolutionPandaSecret123';
const acrilightInst = 'conn_60323974-89c5-4120-a7a1-9c8774e24ed8';

async function checkMessages() {
    let output = `--- EVOLUTION MESSAGE CHECK ---\n\n`;

    try {
        const msgReq = await fetch(`${evoUrl}/chat/findMessages/${acrilightInst}`, {
            method: 'POST',
            headers: { 'apikey': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                where: {
                    key: {
                        remoteJid: "" // blank means all?
                    }
                }
            })
        });
        const messages = await msgReq.json();
        output += `MESSAGES FOR ${acrilightInst}:\n${JSON.stringify(messages, null, 2)}\n\n`;

    } catch (e) {
        output += `ERROR: ${e.message}\n\n`;
    }

    fs.writeFileSync('evo_msg_check.txt', output);
    console.log("Check complete.");
}

checkMessages();
