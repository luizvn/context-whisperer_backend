import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AgentsService } from './agents.service';
import { CreateProjectInput } from './dto/create-project.input';
import { randomUUID } from 'crypto';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.model';

@Resolver()
export class AgentsResolver {
  constructor(private readonly agentsService: AgentsService) {}

  @Mutation(() => String, {
    description: 'Inicia o fluxo de criação de um novo projeto via LangGraph',
  })
  @UseGuards(GqlAuthGuard)
  async createProject(
    @Args('input') input: CreateProjectInput,
    @CurrentUser() user: User,
  ): Promise<string> {
    // 1. Gera um Thread ID único para rastrear a execução no LangGraph/Postgres
    const threadId = randomUUID();

    // 2. Dispara a execução do workflow de forma assíncrona
    // Nota: Como fluxos de IA podem demorar, aqui apenas iniciamos o processo.
    // Dependendo da necessidade, você pode dar await aqui ou rodar em background.
    console.log(`Starting project workflow for thread: ${threadId}`);

    // Para fins de MVP, vamos aguardar o início/primeiro passo.
    // O LangGraph salvará o progresso no banco a cada checkpoint.
    await this.agentsService.executeWorkflow(input, threadId, user);

    // 3. Retorna o threadId para o cliente poder consultar o status depois
    return threadId;
  }
}
