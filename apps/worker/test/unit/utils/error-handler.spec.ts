import { handleWorkerError } from '../../../src/utils/error-handler';

describe('handleWorkerError', () => {
  const mockContext = {
    jobId: 'job-123',
    requisitionId: 'req-456',
    threadId: 'thread-789',
  };

  it('should format template not found errors cleanly', () => {
    const error = new Error("Template 'default_scope' não encontrado no banco de dados.");

    const result = handleWorkerError(error, mockContext);

    expect(result).toEqual({
      statusCode: 500,
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Required template was not found in the database',
    });
  });

  it('should format rate limit / quota errors with 429', () => {
    const error = new Error('OpenAI rate limit reached (429)');

    const result = handleWorkerError(error, mockContext);

    expect(result).toEqual({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'AI service rate limit exceeded. Please try again later.',
    });
  });

  it('should default unexpected errors (e.g. Prisma or Mongo crashes) to 500 with sanitized message', () => {
    const error = new Error(
      'Inconsistent column data: Malformed ObjectID: provided hex string representation must be exactly 12 bytes',
    );

    const result = handleWorkerError(error, mockContext);

    expect(result).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error during project workflow execution',
    });
  });

  it('should handle non-Error objects and default to 500', () => {
    const result = handleWorkerError('Unknown string failure', mockContext);

    expect(result).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error during project workflow execution',
    });
  });
});
