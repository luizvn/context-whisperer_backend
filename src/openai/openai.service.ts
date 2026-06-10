import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class OpenAIService {
  private readonly chatModel: ChatOpenAI;

  constructor() {
    this.chatModel = new ChatOpenAI({
      // Se não passar a API key explicitamente, o LangChain puxa do process.env.OPENAI_API_KEY
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o', // Você pode ajustar o modelo padrão aqui
      temperature: 0, // Temperature 0 é mais determinístico, ideal para geração de UML/Requisitos
    });
  }

  /**
   * Retorna a instância do ChatOpenAI do LangChain.
   * Ideal para ser chamada dentro dos nós (nodes) do LangGraph.
   */
  getChatModel(): ChatOpenAI {
    return this.chatModel;
  }
}
