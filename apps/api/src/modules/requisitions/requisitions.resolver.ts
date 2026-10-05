import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from '../users/user.model';
import { RequisitionModel } from './requisition.model';
import { RequisitionsService } from './requisitions.service';

@Resolver(() => RequisitionModel)
@UseGuards(GqlAuthGuard)
export class RequisitionsResolver {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  @Query(() => [RequisitionModel], {
    name: 'myProjects',
    description: 'Retorna a lista de projetos do usuário autenticado',
  })
  async getMyProjects(
    @CurrentUser() user: UserModel,
  ): Promise<RequisitionModel[]> {
    return this.requisitionsService.findByUserId(user.id);
  }

  @Query(() => RequisitionModel, {
    name: 'project',
    description:
      'Retorna os detalhes completos de um projeto pelo ID com escopo e artefatos',
  })
  async getProject(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: UserModel,
  ): Promise<RequisitionModel> {
    return this.requisitionsService.findByIdWithDetails(id, user.id);
  }
}
