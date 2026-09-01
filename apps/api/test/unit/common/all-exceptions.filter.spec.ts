import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';
import {
  InvalidCredentialsException,
  EntityNotFoundException,
  UserAlreadyExistsException,
  InvalidOperationException,
} from '../../../src/common/exceptions';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { GraphQLError } from 'graphql';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  describe('HTTP context', () => {
    let mockSend: jest.Mock;
    let mockStatus: jest.Mock;
    let mockReply: Partial<FastifyReply>;
    let mockRequest: Partial<FastifyRequest>;
    let mockHost: ArgumentsHost;

    beforeEach(() => {
      mockSend = jest.fn();
      mockStatus = jest.fn().mockReturnValue({ send: mockSend });
      mockReply = {
        status: mockStatus,
      };
      mockRequest = {
        url: '/api/test',
      };
      mockHost = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: () => mockReply,
          getRequest: () => mockRequest,
        }),
      } as unknown as ArgumentsHost;
    });

    it('should handle InvalidCredentialsException (401)', () => {
      const exception = new InvalidCredentialsException();

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
          error: 'Unauthorized',
          message: 'Invalid email or password',
          path: '/api/test',
        }),
      );
    });

    it('should handle EntityNotFoundException (404)', () => {
      const exception = new EntityNotFoundException('Requisition', 'req-999');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: "Requisition with identifier 'req-999' not found",
        }),
      );
    });

    it('should handle UserAlreadyExistsException (409)', () => {
      const exception = new UserAlreadyExistsException();

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'User with this email is already registered',
        }),
      );
    });

    it('should handle InvalidOperationException (400)', () => {
      const exception = new InvalidOperationException();

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Operation not permitted in current state',
        }),
      );
    });

    it('should default unexpected errors to 500 with sanitized message', () => {
      const unexpectedError = new Error('Database connection failed');

      filter.catch(unexpectedError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Internal server error',
          path: '/api/test',
        }),
      );
    });
  });

  describe('GraphQL context', () => {
    let mockHost: ArgumentsHost;

    beforeEach(() => {
      mockHost = {
        getType: jest.fn().mockReturnValue('graphql'),
        getArgs: jest.fn().mockReturnValue([
          {}, // root
          {}, // args
          {}, // context
          { path: { key: 'createProject' } }, // info
        ]),
      } as unknown as ArgumentsHost;
    });

    it('should format GraphQL errors with code and extensions for 401', () => {
      const exception = new InvalidCredentialsException();

      const result = filter.catch(exception, mockHost);

      expect(result).toBeInstanceOf(GraphQLError);
      const gqlError = result as GraphQLError;
      expect(gqlError.message).toBe('Invalid email or password');
      expect(gqlError.extensions).toEqual(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: HttpStatus.UNAUTHORIZED,
        }),
      );
    });

    it('should format unhandled errors in GraphQL as INTERNAL_SERVER_ERROR with status 500', () => {
      const unexpectedError = new Error('Prisma engine crash');

      const result = filter.catch(unexpectedError, mockHost);

      expect(result).toBeInstanceOf(GraphQLError);
      const gqlError = result as GraphQLError;
      expect(gqlError.message).toBe('Internal server error');
      expect(gqlError.extensions).toEqual(
        expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
      );
    });
  });
});
