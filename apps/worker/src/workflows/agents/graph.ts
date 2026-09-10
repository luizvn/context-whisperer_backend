import { StateGraph, START, END } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { GraphState } from "@context-whisperer/core/langgraph";
import { GraphStateType, ArtifactType } from "@context-whisperer/core";
import { scopeAgent, artifactDispatcher, requirementsAgent } from "./nodes";

export const buildGraph = async () => {
  const dbUrl =
    process.env.DATABASE_URL ||
    "mongodb://localhost:27017/context_whisperer?replicaSet=rs0";

  const client = new MongoClient(dbUrl);
  await client.connect();

  const checkpointSaver = new MongoDBSaver({
    client,
    dbName: process.env.MONGODB_DB_NAME || "context_whisperer",
  });

  const graphBuilder = new StateGraph(GraphState)
    .addNode("scopeAgent", scopeAgent)
    .addNode("artifactDispatcher", artifactDispatcher)
    .addNode("requirementsAgent", requirementsAgent)
    .addEdge(START, "scopeAgent")
    .addConditionalEdges("scopeAgent", (state: GraphStateType) => {
      if (state.scopeApproved === true) {
        return "artifactDispatcher";
      }
      if (state.scopeApproved === false) {
        return "scopeAgent";
      }
      return END;
    })
    .addConditionalEdges("artifactDispatcher", (state: GraphStateType) => {
      const artifacts = state.projectRequest?.artifacts ?? [];
      if (artifacts.includes(ArtifactType.REQUIREMENTS)) {
        return "requirementsAgent";
      }
      return END;
    })
    .addEdge("requirementsAgent", END);

  return graphBuilder.compile({ checkpointer: checkpointSaver });
};
