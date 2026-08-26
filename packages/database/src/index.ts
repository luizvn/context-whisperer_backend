import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import * as path from "path";

config({ path: path.resolve(__dirname, "../../../.env") });

export const prisma = new PrismaClient();

export {
  PrismaClient,
  User,
  Requisition,
  ScopeProposal,
  Template,
  Artifact,
} from "@prisma/client";
