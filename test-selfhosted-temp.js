import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://77.37.43.60:8000';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.Wl64243gJ9BWjO_VI9ofW7lynhzrnNO6nvDmeXOnQ3I';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log('Querying self-hosted flows...');
    try {
        const { data: flows, error: flowsErr } = await supabase
            .from('whatsapp_chatbot_flows')
            .select('*');
        if (flowsErr) {
            console.error('Error fetching flows:', flowsErr);
        } else {
            console.log('Flows count:', flows.length);
            console.log('Flows:', JSON.stringify(flows, null, 2));
        }

        const { data: nodes, error: nodesErr } = await supabase
            .from('whatsapp_chatbot_nodes')
            .select('*');
        if (nodesErr) {
            console.error('Error fetching nodes:', nodesErr);
        } else {
            console.log('Nodes count:', nodes.length);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

run();
