// src/lib/auth.ts
// Sessão do painel administrativo (Bearer Token do Laravel Sanctum).
//
// - O token fica no localStorage e é anexado automaticamente a TODAS as
//   chamadas `fetch('/api/...')` do painel (ver installAuthFetch).
// - 401, conta desativada ou perda do papel de admin encerram a sessão e
//   levam para a tela de login.
// - O front nunca decide sozinho o que é permitido: toda checagem real é
//   feita pelo back-end (middleware `auth:sanctum` + `admin`).

const TOKEN_KEY = 'coturnos_admin_token';
const USER_KEY = 'coturnos_admin_user';
export const LOGIN_PATH = '/admin/login';

export interface AdminUser {
  id: string;
  nome: string;
  sobrenome?: string;
  email: string;
  role: string;
}

/** Códigos que o back-end devolve quando a sessão não serve mais para o painel. */
const SESSION_ENDING_CODES = ['UNAUTHENTICATED', 'ACCOUNT_DISABLED', 'ADMIN_REQUIRED', 'TOKEN_SCOPE'];

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado: a sessão vale só nesta aba */
  }
}

export function getToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function getUser(): AdminUser | null {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function saveSession(token: string, user: AdminUser): void {
  safeSet(TOKEN_KEY, token);
  safeSet(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  safeSet(TOKEN_KEY, null);
  safeSet(USER_KEY, null);
}

function redirectToLogin(): void {
  clearSession();
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}

const nativeFetch: typeof fetch = window.fetch.bind(window);

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/**
 * Intercepta o fetch global: injeta `Authorization: Bearer <token>` e
 * `Accept: application/json` nas chamadas à própria API e trata o fim da sessão.
 * Chamado uma vez em main.tsx — as páginas continuam usando `fetch` normalmente.
 */
export function installAuthFetch(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    const response = await nativeFetch(input, { ...init, headers });

    const isLoginCall = String(input instanceof Request ? input.url : input).includes('/auth/login');
    if (!isLoginCall && (response.status === 401 || response.status === 403)) {
      if (response.status === 401) {
        redirectToLogin();
      } else {
        const body = await response.clone().json().catch(() => ({}));
        if (SESSION_ENDING_CODES.includes(body?.code)) {
          redirectToLogin();
        }
      }
    }

    return response;
  };
}

export async function login(email: string, senha: string): Promise<AdminUser> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || 'Não foi possível entrar. Tente novamente.');
  }

  const user = json.data?.usuario as AdminUser | undefined;
  const token = json.data?.token as string | undefined;
  const abilities: string[] = json.data?.abilities ?? [];

  if (!token || !user || user.role?.toLowerCase() !== 'admin' || !abilities.includes('admin')) {
    // Revoga o token recém-emitido de quem não é administrador.
    if (token) {
      await nativeFetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }).catch(() => undefined);
    }
    throw new Error('Acesso restrito: esta conta não tem permissão de administrador.');
  }

  saveSession(token, user);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

/** Confirma no servidor que o token ainda vale e pertence a um admin ativo. */
export async function verifySession(): Promise<boolean> {
  if (!getToken()) return false;
  try {
    const res = await fetch('/api/v1/auth/me');
    if (!res.ok) return false;
    const json = await res.json();
    const user = json.data?.usuario as AdminUser | undefined;
    const abilities: string[] = json.data?.abilities ?? [];
    if (!user || user.role?.toLowerCase() !== 'admin' || !abilities.includes('admin')) {
      clearSession();
      return false;
    }
    saveSession(getToken() as string, user);
    return true;
  } catch {
    return false;
  }
}
