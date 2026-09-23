import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, apiRequest } from './api';

interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string;
}

interface Session {
  accessToken: string;
  user: User;
}

interface Registration {
  user: User;
  verificationToken?: string;
}

interface AuthContextValue {
  accessToken?: string;
  user?: User;
  ready: boolean;
  register(input: {
    email: string;
    handle: string;
    displayName: string;
    password: string;
  }): Promise<Registration>;
  verify(token: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let sessionRestoration: Promise<Session | undefined> | undefined;

async function requestSession(attempt = 0): Promise<Session | undefined> {
  try {
    return await apiRequest<Session>('/auth/refresh', { method: 'POST' });
  } catch (reason) {
    if ((reason instanceof ApiError && reason.status === 401) || attempt === 12) {
      return undefined;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
    return requestSession(attempt + 1);
  }
}

function restoreSession() {
  sessionRestoration ??= requestSession().finally(() => {
    sessionRestoration = undefined;
  });
  return sessionRestoration;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setSession)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => void restoreSession().then(setSession),
      13 * 60 * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.accessToken,
      user: session?.user,
      ready,
      register: (input) =>
        apiRequest<Registration>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      verify: async (token) => {
        await apiRequest('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
      },
      login: async (email, password) => {
        setSession(
          await apiRequest<Session>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }),
        );
      },
      logout: async () => {
        if (session?.accessToken) {
          await apiRequest(
            '/auth/logout',
            { method: 'POST' },
            session.accessToken,
          );
        }
        setSession(undefined);
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
