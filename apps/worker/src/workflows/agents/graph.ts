import { StateGraph, START, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { GraphState } from './state';
import { scopeAgent } from './nodes';

export const buildGraph = async () => {
  // Instancia e configura o checkpointer aqui dentro para evitar top-level await
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:senha@localhost:5432/context_whisperer';

  const checkpointSaver = PostgresSaver.fromConnString(dbUrl);

  await checkpointSaver.setup();

  const graphBuilder = new StateGraph(GraphState)
    // 1. Adiciona os Nós (Nodes)
    .addNode('scopeAgent', scopeAgent)

    // 2. Define o fluxo principal (Edges)
    .addEdge(START, 'scopeAgent')
    .addEdge('scopeAgent', END);

  // 4. Compila o grafo para execução e atrela o checkpointer
  return graphBuilder.compile({ checkpointer: checkpointSaver });
};
