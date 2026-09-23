import { SessionState, SessionStore } from "../../shared/contracts";

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionState>();
  private ttlMs: number;

  constructor(ttlMinutes: number = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (Date.now() - session.updatedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  async save(session: SessionState): Promise<void> {
    // Keep max 12 turns in history to prevent context explosion
    const boundedHistory = session.history.slice(-12);

    this.sessions.set(session.id, {
      ...session,
      history: boundedHistory,
      updatedAt: session.updatedAt || Date.now(),
    });
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
