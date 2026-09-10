import { DomainException } from './domain.exception';

export class ScopeProposalNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      `Scope proposal with identifier '${id}' not found`,
      'SCOPE_PROPOSAL_NOT_FOUND',
      404,
      { id },
    );
  }
}

export class ScopeProposalAlreadyProcessedException extends DomainException {
  constructor(id: string, currentStatus: string) {
    super(
      `Scope proposal '${id}' has already been processed with status '${currentStatus}'`,
      'SCOPE_PROPOSAL_ALREADY_PROCESSED',
      400,
      { id, currentStatus },
    );
  }
}

export class ScopeProposalFeedbackRequiredException extends DomainException {
  constructor() {
    super(
      'Feedback is required when rejecting a scope proposal',
      'SCOPE_PROPOSAL_FEEDBACK_REQUIRED',
      400,
    );
  }
}
