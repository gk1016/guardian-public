/**
 * Auth context — loads session from /api/auth/me on mount, provides
 * useAuth() and <ProtectedRoute> to the entire app.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router";

export type Session = {
  userId: string;
  email: string;
  handle: string;
  role: string;
  displayName?: string;
  status: string;
  orgId?: string;
  orgTag?: string;
  orgName?: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; session: Session }
  | { status: "unauthenticated" };

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  refresh: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/** Convenience — returns session or throws (use inside ProtectedRoute). */
export function useSession(): Session {
  const auth = useAuth();
  if (auth.status !== "authenticated") {
    throw new Error("useSession() called outside authenticated context");
  }
  return auth.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setState({ status: "unauthenticated" });
        return;
      }
      const session: Session = await res.json();
      setState({ status: "authenticated", session });
    } catch {
      setState({ status: "unauthenticated" });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best effort
    }
    setState({ status: "unauthenticated" });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value: AuthContextValue =
    state.status === "authenticated"
      ? { ...state, refresh, logout }
      : state.status === "unauthenticated"
        ? { ...state, refresh, logout }
        : { status: "loading", refresh, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Wrap around routes that require auth. Redirects to /login if not
 * authenticated, shows nothing while loading.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Loading...
        </span>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
}
