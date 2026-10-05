import { Injectable, inject } from "@angular/core";
import { AuthService } from "./auth.service";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

@Injectable({
  providedIn: "root",
})
export class GraphQLService {
  private readonly authService = inject(AuthService);
  private readonly endpoint = "/api/graphql";

  /**
   * Executa uma consulta ou mutação GraphQL tipada
   */
  async execute<T>(operation: string, variables?: Record<string, unknown>): Promise<T> {
    const token = this.authService.token();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: operation,
        variables,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.authService.logout();
      }
      throw new Error(`Erro HTTP ao chamar GraphQL: ${response.status} ${response.statusText}`);
    }

    const json: GraphQLResponse<T> = await response.json();

    if (json.errors && json.errors.length > 0) {
      const isUnauthorized = json.errors.some((e) =>
        e.message?.toLowerCase().includes("unauthorized"),
      );
      if (isUnauthorized) {
        this.authService.logout();
      }
      const message = json.errors.map((e) => e.message).join("; ");
      throw new Error(`Erro GraphQL: ${message}`);
    }

    if (!json.data) {
      throw new Error("Resposta GraphQL vazia sem dados retornados.");
    }

    return json.data;
  }
}
