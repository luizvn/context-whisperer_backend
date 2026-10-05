import { Injectable, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface SignupDto {
  name: string;
  email: string;
  password: string;
}

interface AuthGraphQLResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly router = inject(Router);

  private readonly TOKEN_KEY = "cw_token";
  private readonly USER_KEY = "cw_user";

  private readonly _token = signal<string | null>(this.getInitialToken());
  private readonly _currentUser = signal<AuthUser | null>(this.getInitialUser());
  private readonly _loading = signal<boolean>(false);

  readonly token = this._token.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly loading = this._loading.asReadonly();

  private getInitialToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private getInitialUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Realiza login do usuário com e-mail e senha via GraphQL
   */
  async login(dto: LoginDto): Promise<AuthUser> {
    this._loading.set(true);

    const query = `
      mutation Login($input: LoginInput!) {
        login(loginInput: $input) {
          accessToken
          user {
            id
            name
            email
            role
          }
        }
      }
    `;

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            input: {
              email: dto.email.trim(),
              password: dto.password,
            },
          },
        }),
      });

      const json = await res.json();

      if (json.errors && json.errors.length > 0) {
        const errorMsg = json.errors[0]?.message || "Falha ao realizar login.";
        throw new Error(errorMsg);
      }

      const data: AuthGraphQLResponse = json.data?.login;
      if (!data?.accessToken) {
        throw new Error("Resposta de autenticação inválida.");
      }

      this.saveSession(data);
      return data.user;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Realiza cadastro de novo usuário com nome, e-mail e senha via GraphQL
   */
  async signup(dto: SignupDto): Promise<AuthUser> {
    this._loading.set(true);

    const query = `
      mutation Signup($input: SignupInput!) {
        signup(signupInput: $input) {
          accessToken
          user {
            id
            name
            email
            role
          }
        }
      }
    `;

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            input: {
              name: dto.name.trim(),
              email: dto.email.trim(),
              password: dto.password,
            },
          },
        }),
      });

      const json = await res.json();

      if (json.errors && json.errors.length > 0) {
        const errorMsg = json.errors[0]?.message || "Falha ao cadastrar usuário.";
        throw new Error(errorMsg);
      }

      const data: AuthGraphQLResponse = json.data?.signup;
      if (!data?.accessToken) {
        throw new Error("Resposta de cadastro inválida.");
      }

      this.saveSession(data);
      return data.user;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Valida o token existente no início da aplicação ou restaura os dados
   */
  async initSession(): Promise<boolean> {
    const token = this._token();
    if (!token) {
      return false;
    }

    const query = `
      query Me {
        me {
          id
          name
          email
          role
        }
      }
    `;

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();

      if (json.errors && json.errors.length > 0) {
        // Token expirado ou inválido
        this.clearSession();
        return false;
      }

      const user: AuthUser = json.data?.me;
      if (user) {
        this._currentUser.set(user);
        try {
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        } catch {
          // ignora erro de storage
        }
        return true;
      }

      this.clearSession();
      return false;
    } catch {
      // Se não conseguir conectar ao servidor mas tem token local, mantém a sessão
      return !!this._currentUser();
    }
  }

  saveSession(auth: AuthGraphQLResponse): void {
    this._token.set(auth.accessToken);
    this._currentUser.set(auth.user);
    try {
      localStorage.setItem(this.TOKEN_KEY, auth.accessToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(auth.user));
    } catch {
      // Ignora falhas de localStorage em contexto restrito
    }
  }

  clearSession(): void {
    this._token.set(null);
    this._currentUser.set(null);
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch {
      // Ignora falhas de localStorage
    }
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(["/login"]);
  }
}
