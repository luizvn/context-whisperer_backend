import { Injectable, OnModuleInit } from '@nestjs/common';
import { buildGraph } from './langgraph/graph';
import { CreateProjectInput } from './dto/create-project.input';
import { OpenAIService } from '../../openai/openai.service';
import { ScopeProposalService } from '../scope-proposals/scope-proposal.service';
import { User } from '../users/user.model';
import { RequisitionsService } from '../requisitions/requisitions.service';

@Injectable()
export class AgentsService implements OnModuleInit {
  private graph!: Awaited<ReturnType<typeof buildGraph>>;

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly scopeProposalService: ScopeProposalService,
    private readonly requisitionService: RequisitionsService,
  ) {}

  async onModuleInit() {
    // Agora buildGraph é assíncrono porque configura o banco de dados
    this.graph = await buildGraph();
  }

  async executeWorkflow(
    projectRequest: CreateProjectInput,
    threadId: string,
    user: User,
  ) {
    const { id } = await this.requisitionService.create(
      user.id,
      projectRequest.prompt,
    );

    const initialState = {
      projectRequest,
      messages: [],
      requisitionId: id,
    };

    // Invoca o grafo LangGraph com o estado inicial e passa o threadId e os serviços via configurable
    const result = await this.graph.invoke(initialState, {
      configurable: {
        thread_id: threadId,
        openAIService: this.openAIService, // Passa o serviço injetado pelo NestJS
        scopeProposalService: this.scopeProposalService,
      },
    });
    return result;
  }
}
