const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Analisa uma mensagem para sugerir a transferência para uma fila específica.
 * @param {string} message - O conteúdo da mensagem recebida.
 * @param {Array} queues - Lista de filas disponíveis [{id, name}].
 * @param {string} apiKey - Chave de API do Gemini da empresa.
 * @returns {Promise<string|null>} - Retorna o queue_id sugerido ou null.
 */
async function analyzeMessageForTransfer(message, queues, apiKey) {
    if (!apiKey || !queues || queues.length === 0) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
        Aja como um atendente de triagem inteligente. Analise a mensagem abaixo e responda APENAS com o ID da fila para a qual o atendimento deve ser transferido.
        Se a mensagem não for clara o suficiente para saber para qual fila enviar, responda "NULL".

        Filas Disponíveis (ID: Nome):
        ${queues.map(q => `${q.id}: ${q.name}`).join('\n')}

        Mensagem do Cliente: "${message}"

        ID da Fila Sugerida:`;

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
