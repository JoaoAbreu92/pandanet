const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Analisa uma mensagem para sugerir a transferência para uma fila ou agente específico.
 * @param {string} message - O conteúdo da mensagem recebida.
 * @param {Array} queues - Lista de filas disponíveis [{id, name}].
 * @param {Array} agents - Lista de atendentes disponíveis [{id, full_name}].
 * @param {string} apiKey - Chave de API do Gemini da empresa.
 * @param {object} businessHours - Configurações de horários complexos JSONB { general: {}, queues: {} }
 * @returns {Promise<{target_type: 'queue'|'agent'|'none', target_id: string|null}>} - Retorna o tipo de destino e o ID sugerido.
 */
async function analyzeMessageForTransfer(message, queues, agents, apiKey, businessHours = null) {
    if (!apiKey) return { target_type: 'none', target_id: null };

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const spTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const daysMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const currentDayStr = daysMap[spTime.getDay()];
        const currentHourStr = `${spTime.getHours().toString().padStart(2, '0')}:${spTime.getMinutes().toString().padStart(2, '0')}`;

        // Calcular se cada fila está aberta ou fechada com base nas businessHours
        const queuesStatus = (queues || []).map(q => {
            let status = 'Aberta';
            let detail = 'Expediente Geral';

            if (businessHours) {
                const currentDayIdx = spTime.getDay().toString(); // "0" a "6"
                if (businessHours.queues && businessHours.queues[q.id]) {
                    const dayConfig = businessHours.queues[q.id][currentDayIdx];
                    if (dayConfig && dayConfig.length > 0) {
                        const inRange = dayConfig.some(interval => currentHourStr >= interval.start && currentHourStr <= interval.end);
                        status = inRange ? 'Aberta' : 'Fechada';
                        detail = `Horário: ${dayConfig.map(i => `${i.start}-${i.end}`).join(', ')}`;
                    } else {
                        status = 'Fechada';
                        detail = 'Não atende hoje';
                    }
                } else if (businessHours.general && businessHours.general[currentDayIdx]) {
                    const dayConfig = businessHours.general[currentDayIdx];
                    if (dayConfig && dayConfig.length > 0) {
                        const inRange = dayConfig.some(interval => currentHourStr >= interval.start && currentHourStr <= interval.end);
                        status = inRange ? 'Aberta' : 'Fechada';
                        detail = `Horário Geral: ${dayConfig.map(i => `${i.start}-${i.end}`).join(', ')}`;
                    } else {
                        status = 'Fechada';
                        detail = 'Geral Fechado';
                    }
                }
            }

            return {
                id: q.id,
                name: q.name,
                status: status,
                detail: detail
            };
        });

        const prompt = `
        Aja como um atendente de triagem inteligente de WhatsApp para uma empresa.
        Sua tarefa é analisar a mensagem do cliente e identificar qual o setor (fila) ou atendente (agente) mais adequado para transferir a conversa.
        
        INFORMAÇÕES DE CONTEXTO:
        - Dia da Semana Atual: ${currentDayStr}
        - Hora de Brasília Atual: ${currentHourStr}

        SETORES (FILAS) DISPONÍVEIS E SEU STATUS ATUAL:
        ${queuesStatus.map(qs => `- ID: ${qs.id} | Nome: ${qs.name} | Status: ${qs.status} (${qs.detail})`).join('\n')}

        ATENDENTES (AGENTES) DISPONÍVEIS PARA TRANSFERÊNCIA DIRETA:
        ${(agents || []).map(a => `- ID: ${a.id} | Nome: ${a.full_name}`).join('\n')}

        REGRAS CRÍTICAS DE DECISÃO:
        1. Priorize a transferência para um SETOR (fila) de acordo com o interesse ou necessidade demonstrada na mensagem (ex: financeiro, suporte, vendas).
        2. Transfira para um ATENDENTE (agente) específico se o cliente mencionar o nome dele explicitamente na mensagem (ex: "quero falar com o João", "me passa para a Ana") e o ID dele coincidir com a lista.
        3. Você NÃO deve transferir para um setor que esteja com status "Fechada", pois o cliente ficará sem atendimento. Se o setor correspondente estiver fechado, verifique se há outro setor aberto que possa triar ou responda que não há setores disponíveis.
        4. O retorno deve ser OBRIGATORIAMENTE um objeto JSON válido, sem markdown, no seguinte formato:
           { 
             "target_type": "queue" | "agent" | "none", 
             "target_id": "ID_DO_SETOR_OU_DO_ATENDENTE_OU_NULL",
             "response": "Mensagem educada e amigável em português para enviar de volta ao cliente"
           }
        5. Se a mensagem não se encaixar em nenhum setor ou se você não tiver certeza de quem deve atender:
           - Defina target_type como "none" e target_id como null.
           - Em "response", escreva uma resposta em português (PT-BR) educada, prestativa e natural. Se o cliente estiver apenas cumprimentando (ex: "olá", "bom dia", "tudo bem?"), cumprimente-o de volta de forma muito calorosa, liste os setores abertos no momento para atendimento, e pergunte como pode ajudar de forma objetiva.
        6. Se o target_type for "queue" ou "agent":
           - Em "response", escreva uma breve mensagem simpática avisando que a conversa está sendo direcionada para aquele setor ou atendente específico (ex: "Com certeza! Vou transferir você para o setor de Comercial / Vendas agora. Um instante, por favor.").

        Mensagem do Cliente: "${message}"

        JSON Result:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Limpar possíveis blocos de código markdown do JSON
        text = text.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

        console.log(`[GEMINI-TRIAGEM] Resposta bruta da IA:`, text);

        const parsed = JSON.parse(text);
        
        if (parsed.target_type === 'queue') {
            const exists = queues.some(q => q.id === parsed.target_id);
            return exists ? parsed : { target_type: 'none', target_id: null, response: parsed.response || null };
        } else if (parsed.target_type === 'agent') {
            const exists = agents.some(a => a.id === parsed.target_id);
            return exists ? parsed : { target_type: 'none', target_id: null, response: parsed.response || null };
        }

        return { target_type: 'none', target_id: null, response: parsed.response || null };
    } catch (error) {
        console.error('[GEMINI] Erro ao analisar mensagem:', error.message);
        return { target_type: 'none', target_id: null, response: null };
    }
}

module.exports = { analyzeMessageForTransfer };

module.exports = { analyzeMessageForTransfer };
