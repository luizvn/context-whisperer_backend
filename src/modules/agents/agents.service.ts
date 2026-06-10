import { Injectable, OnModuleInit } from '@nestjs/common';
import { buildGraph } from './langgraph/graph';
import { CreateProjectInput } from './dto/create-project.input';

@Injectable()
export class AgentsService implements OnModuleInit {
  // O tipo inferido muda porque buildGraph agora retorna uma Promise
  private graph!: Awaited<ReturnType<typeof buildGraph>>;

  async onModuleInit() {
    // Agora buildGraph é assíncrono porque configura o banco de dados
    this.graph = await buildGraph();
  }

  async executeWorkflow(projectRequest: CreateProjectInput, threadId: string) {
    const initialState = {
      projectRequest,
      messages: [],
    };

    // Invoca o grafo LangGraph com o estado inicial e passa o threadId para o checkpointer
    const result = await this.graph.invoke(initialState, {
      configurable: { thread_id: threadId },
    });
    return result;
  }
}
