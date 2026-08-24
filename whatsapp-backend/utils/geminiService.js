const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Analisa uma mensagem para sugerir a transferência para uma fila específica, considerando os horários de funcionamento.
 * @param {string} message - O conteúdo da mensagem recebida.
 * @param {Array} queues - Lista de filas disponíveis [{id, name}].
 * @param {string} apiKey - Chave de API do Gemini da empresa.
 * @param {object} businessHours - Configurações de horários complexos JSONB { general: {}, queues: {} }
 * @returns {Promise<string|null>} - Retorna o queue_id sugerido ou null.
 */
async function analyzeMessageForTransfer(message, queues, apiKey, businessHours = null) {
    if (!apiKey || !queues || queues.length === 0) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const now = new Date();
        const spOffset = -3;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const spTime = new Date(utc + (3600000 * spOffset));
        const daysMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const currentDayStr = daysMap[spTime.getDay()];
        const currentHourStr = spTime.toTimeString().slice(0, 5); // "HH:MM"

        // Calcular se cada fila está aberta ou fechada com base nas businessHours
        const queuesStatus = queues.map(q => {
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
        Sua tarefa é analisar a mensagem do cliente e identificar qual o setor (fila) mais adequado para transferir a conversa.
        
        INFORMAÇÕES DE CONTEXTO:
        - Dia da Semana Atual: ${currentDayStr}
        - Hora de Brasília Atual: ${currentHourStr}

        SETORES (FILAS) DISPONÍVEIS E SEU STATUS ATUAL:
        ${queuesStatus.map(qs => `- ID: ${qs.id} | Nome: ${qs.name} | Status: ${qs.status} (${qs.detail})`).join('\n')}

        REGRAS CRÍTICAS:
        1. Responda APENAS com o ID da fila selecionada. Não inclua nenhuma outra palavra, pontuação ou texto.
        2. Se a mensagem não se encaixar em nenhum setor ou se você não tiver certeza, responda "NULL".
        3. IMPORTANTE: Você NÃO deve transferir para um setor que esteja com status "Fechada", pois o cliente ficará sem atendimento. Se o setor correspondente estiver fechado, verifique se há um setor geral/alternativo que esteja "Aberta" para triagem rápida, caso contrário, responda "NULL".

        Mensagem do Cliente: "${message}"

        ID do Setor Sugerido:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        if (text === "NULL") return null;

        // Validar se o ID retornado existe nas filas
        const suggestedQueue = queues.find(q => q.id === text);
        return suggestedQueue ? suggestedQueue.id : null;
    } catch (error) {
        console.error('[GEMINI] Erro ao analisar mensagem:', error.message);
        return null;
    }
}

module.exports = { analyzeMessageForTransfer };
