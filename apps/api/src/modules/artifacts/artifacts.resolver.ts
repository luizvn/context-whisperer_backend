import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from '../users/user.model';
import { ArtifactsService } from './artifacts.service';
import { ArtifactsZipModel } from './dto/artifacts-zip.model';

@Resolver()
export class ArtifactsResolver {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Query(() => ArtifactsZipModel, {
    name: 'downloadArtifactsZip',
    description:
      'Gera e retorna o pacote ZIP estruturado com todos os artefatos técnicos da requisição',
  })
  @UseGuards(GqlAuthGuard)
  async downloadArtifactsZip(
    @Args('requisitionId', { type: () => ID }) requisitionId: string,
    @CurrentUser() user: UserModel,
  ): Promise<ArtifactsZipModel> {
    return this.artifactsService.generateZip(requisitionId, user.id, user.role);
  }
}
