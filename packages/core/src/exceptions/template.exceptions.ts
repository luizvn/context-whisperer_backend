import { DomainException } from './domain.exception';

export class TemplateNotFoundException extends DomainException {
  constructor(templateName: string) {
    super(
      `Template '${templateName}' not found in database`,
      'TEMPLATE_NOT_FOUND',
      404,
      { templateName },
    );
  }
}

export class InvalidTemplateException extends DomainException {
  constructor(templateName: string, reason?: string) {
    super(
      `Template '${templateName}' is invalid${reason ? `: ${reason}` : ''}`,
      'INVALID_TEMPLATE',
      400,
      { templateName, reason },
    );
  }
}

export class TemplateRenderException extends DomainException {
  constructor(templateName: string, reason?: string) {
    super(
      `Failed to render template '${templateName}'${reason ? `: ${reason}` : ''}`,
      'TEMPLATE_RENDER_ERROR',
      500,
      { templateName, reason },
    );
  }
}
