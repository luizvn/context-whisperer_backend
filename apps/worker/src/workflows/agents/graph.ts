import { StateGraph, START, END } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { GraphState } from "@context-whisperer/core/langgraph";
import { scopeAgent } from "./nodes";

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
    .addEdge(START, "scopeAgent")
    .addEdge("scopeAgent", END);

  return graphBuilder.compile({ checkpointer: checkpointSaver });
};
