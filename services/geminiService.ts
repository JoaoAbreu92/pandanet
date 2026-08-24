
import { GoogleGenAI, Type } from "@google/genai";
// FIX: Correcting the import path for types.
import type { Announcement } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const fetchAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Gere 4 anúncios corporativos profissionais e diversificados em português do Brasil. Para cada um, inclua: título, resumo, categoria, data. As categorias devem ser EXATAMENTE uma destas: 'Notícias da Empresa', 'Atualização de Produto', 'RH & Cultura', 'Evento'. Opcionalmente, adicione um 'imageUrl' de um serviço de placeholder (ex: picsum.photos) e/ou um 'videoUrl' do YouTube se for relevante.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "O título do anúncio."
              },
              summary: {
                type: Type.STRING,
                description: "Um resumo curto e envolvente do anúncio (2-3 sentenças)."
              },
              category: {
                type: Type.STRING,
                description: "A categoria do anúncio."
              },
              date: {
                type: Type.STRING,
                description: "A data de publicação no formato 'Dia de Mês de Ano' (ex: '26 de Julho de 2024')."
              },
              imageUrl: {
                type: Type.STRING,
                description: "URL de uma imagem relevante para o anúncio (opcional)."
              },
              videoUrl: {
                type: Type.STRING,
                description: "URL de um vídeo do YouTube relevante (opcional)."
              }
            },
            required: ["title", "summary", "category", "date"]
          }
        },
      },
    });

    const jsonText = response.text.trim();
    // FIX: Parsing the JSON string may fail. Added a try-catch block for safety.
    try {
      const announcements = JSON.parse(jsonText);
      return announcements as Announcement[];
    } catch (e) {
       console.error("Error parsing announcements JSON from Gemini:", e);
       throw e; // re-throw to be caught by outer catch
    }

  } catch (error) {
    console.error("Error fetching announcements from Gemini:", error);
    // Return mock data on failure to ensure the UI is still functional.
    return [
      { id: 'mock-1', title: 'Erro de API: Não foi possível buscar notícias', summary: 'Houve um problema ao conectar com o serviço de notícias. Verifique a chave da API e tente novamente mais tarde. Exibindo dados de exemplo.', category: 'Notícias da Empresa', date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), imageUrl: 'https://picsum.photos/id/103/800/400' },
      { id: 'mock-2', title: 'Reunião Geral do Terceiro Trimestre', summary: 'Junte-se a nós para nossa reunião trimestral na próxima sexta-feira para discutir nosso progresso e metas futuras.', category: 'Evento', date: '2 de Agosto de 2024', imageUrl: 'https://picsum.photos/id/105/800/400', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    ];
  }
};