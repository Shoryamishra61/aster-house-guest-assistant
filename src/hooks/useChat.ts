import { useReducer, useCallback } from "react";
import { ChatResponse, RoomResult } from "@/shared/contracts";

export type MessageItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  type?: ChatResponse["type"];
  rooms?: RoomResult[];
  query?: { checkIn: string; checkOut: string; adults: number; nights: number };
  missingFields?: Array<"checkIn" | "checkOut" | "adults">;
  currentValues?: Partial<{ checkIn: string; checkOut: string; adults: number }>;
  sources?: Array<{ id: string; label: string }>;
  isError?: boolean;
};

export type ChatState = {
  sessionId: string;
  messages: MessageItem[];
  status: "idle" | "sending" | "error";
  error: { message: string; retryable: boolean; failedMessage?: string } | null;
  activeAvailabilityPrompt: {
    missingFields: Array<"checkIn" | "checkOut" | "adults">;
    currentValues: Partial<{ checkIn: string; checkOut: string; adults: number }>;
  } | null;
};

type ChatAction =
  | { type: "SEND_START"; message: string }
  | { type: "RECEIVE_SUCCESS"; response: ChatResponse }
  | { type: "RECEIVE_ERROR"; errorMsg: string; retryable: boolean; failedMessage: string }
  | { type: "RETRY" }
  | { type: "RESET" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SEND_START": {
      const userMsg: MessageItem = {
        id: `msg_${Date.now()}_u`,
        role: "user",
        text: action.message,
      };
      return {
        ...state,
        status: "sending",
        error: null,
        messages: [...state.messages, userMsg],
      };
    }
    case "RECEIVE_SUCCESS": {
      const resp = action.response;
      const assistantMsg: MessageItem = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        text: resp.message,
        type: resp.type,
        rooms: "rooms" in resp ? resp.rooms : undefined,
        query: "query" in resp ? resp.query : undefined,
        missingFields: "missingFields" in resp ? resp.missingFields : undefined,
        currentValues: "currentValues" in resp ? resp.currentValues : undefined,
        sources: "sources" in resp ? resp.sources : undefined,
      };

      const newPrompt =
        resp.type === "needs_input"
          ? {
              missingFields: resp.missingFields,
              currentValues: resp.currentValues,
            }
          : null;

      return {
        ...state,
        sessionId: resp.sessionId,
        status: "idle",
        error: null,
        activeAvailabilityPrompt: newPrompt,
        messages: [...state.messages, assistantMsg],
      };
    }
    case "RECEIVE_ERROR": {
      return {
        ...state,
        status: "error",
        error: {
          message: action.errorMsg,
          retryable: action.retryable,
          failedMessage: action.failedMessage,
        },
      };
    }
    case "RETRY": {
      return {
        ...state,
        status: "idle",
        error: null,
      };
    }
    case "RESET": {
      return {
        sessionId: "",
        messages: [],
        status: "idle",
        error: null,
        activeAvailabilityPrompt: null,
      };
    }
    default:
      return state;
  }
}

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, {
    sessionId: "",
    messages: [],
    status: "idle",
    error: null,
    activeAvailabilityPrompt: null,
  });

  const sendMessage = useCallback(
    async (
      text: string,
      structuredAvailability?: {
        checkIn?: string;
        checkOut?: string;
        adults?: number;
      }
    ) => {
      if (!text.trim() && !structuredAvailability) return;

      const trimmedText = text.trim() || "Check room availability";
      dispatch({ type: "SEND_START", message: trimmedText });

      try {
        const payload: Record<string, unknown> = {
          message: trimmedText,
        };
        if (state.sessionId) {
          payload.sessionId = state.sessionId;
        }
        if (structuredAvailability) {
          payload.availability = structuredAvailability;
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errorMsg =
            errData.message || `Server communication issue (${res.status}). Please try again.`;
          dispatch({
            type: "RECEIVE_ERROR",
            errorMsg,
            retryable: true,
            failedMessage: trimmedText,
          });
          return;
        }

        const data: ChatResponse = await res.json();
        dispatch({ type: "RECEIVE_SUCCESS", response: data });
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error
            ? "Network connection issue. Please check your internet connection."
            : "An unexpected error occurred.";
        dispatch({
          type: "RECEIVE_ERROR",
          errorMsg,
          retryable: true,
          failedMessage: trimmedText,
        });
      }
    },
    [state.sessionId]
  );

  const retryLast = useCallback(() => {
    if (state.error?.failedMessage) {
      const msg = state.error.failedMessage;
      dispatch({ type: "RETRY" });
      sendMessage(msg);
    }
  }, [state.error, sendMessage]);

  return {
    state,
    sendMessage,
    retryLast,
  };
}
