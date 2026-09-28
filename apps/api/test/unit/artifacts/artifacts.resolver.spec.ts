import { Test, TestingModule } from '@nestjs/testing';
import { ArtifactsResolver } from '../../../src/modules/artifacts/artifacts.resolver';
import { ArtifactsService } from '../../../src/modules/artifacts/artifacts.service';
import { UserModel } from '../../../src/modules/users/user.model';
import { ArtifactsZipModel } from '../../../src/modules/artifacts/dto/artifacts-zip.model';

describe('ArtifactsResolver', () => {
  let resolver: ArtifactsResolver;
  const mockGenerateZip = jest.fn();

  const mockUser: UserModel = {
    id: 'user-resolver-123',
    name: 'Neo',
    email: 'neo@matrix.org',
    role: 'user',
    createdAt: new Date(),
  };

  const mockZipResponse: ArtifactsZipModel = {
    fileName: 'specs-123456.zip',
    contentType: 'application/zip',
    sizeBytes: 1024,
    base64: 'UEsDBBQAAAAIA...',
    includedFiles: [
      'docs/scope.md',
      'docs/requirements.md',
      'PROMPT.md',
      'README.md',
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactsResolver,
        {
          provide: ArtifactsService,
          useValue: {
            generateZip: mockGenerateZip,
          },
        },
      ],
    }).compile();

    resolver = module.get<ArtifactsResolver>(ArtifactsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('downloadArtifactsZip', () => {
    it('should delegate download call to artifactsService with requisitionId and user context', async () => {
      mockGenerateZip.mockResolvedValue(mockZipResponse);

      const result = await resolver.downloadArtifactsZip(
        'req-abc-123',
        mockUser,
      );

      expect(mockGenerateZip).toHaveBeenCalledWith(
        'req-abc-123',
        mockUser.id,
        mockUser.role,
      );
      expect(result).toEqual(mockZipResponse);
    });
  });
});
