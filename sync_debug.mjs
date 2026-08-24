
import fetch from 'node-fetch';
import fs from 'fs';

const evoUrl = 'http://77.37.43.60:8080';
const evoKey = 'EvolutionPandaSecret123';
const CONNECTION_ID = '60323974-89c5-4120-a7a1-9c8774e24ed8';
const INSTANCE_NAME = `conn_${CONNECTION_ID}`;

async function searchEndpoints() {
    let output = `--- ENDPOINT SEARCH LOG for ${INSTANCE_NAME} ---\n\n`;

    const commonEndpoints = [
        `/contact/fetchContacts/${INSTANCE_NAME}`,
        `/contact/findAll/${INSTANCE_NAME}`,
        `/instance/fetchInstances`,
        `/chat/findMessages/${INSTANCE_NAME}`
    ];

    for (const url of commonEndpoints) {
        output += `>>> TESTING GET ${url}...\n`;
        try {
            const res = await fetch(`${evoUrl}${url}`, {
                method: 'GET',
                headers: { 'apikey': evoKey }
            });
            const data = await res.json();
            output += `STATUS: ${res.status}\n`;
            output += `RESULT (first 500 chars): ${JSON.stringify(data, null, 2).slice(0, 500)}\n\n`;
        } catch (e) {
            output += `ERROR: ${e.message}\n\n`;
        }
    }

    fs.writeFileSync('endpoint_search_results.txt', output);
    console.log("Search complete.");
}

searchEndpoints();
