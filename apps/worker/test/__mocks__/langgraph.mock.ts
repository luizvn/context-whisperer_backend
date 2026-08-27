const annotationFn: any = jest.fn(() => ({}));
annotationFn.Root = jest.fn(() => ({}));

export const Annotation = annotationFn;
export const START = '__start__';
export const END = '__end__';

export class StateGraph {
  constructor(public state: unknown) {}

  addNode(_name: string, _action: unknown) {
    return this;
  }

  addEdge(_from: string, _to: string) {
    return this;
  }

  compile(options?: unknown) {
    return {
      invoke: jest.fn(),
      options,
    };
  }
}
