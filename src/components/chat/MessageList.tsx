import React, { useState } from "react";
import { MessageItem } from "@/hooks/useChat";
import { RoomResults } from "../availability/RoomResults";
import { AvailabilityForm } from "../availability/AvailabilityForm";

interface MessageListProps {
  messages: MessageItem[];
  activeAvailabilityPrompt: {
    missingFields: Array<"checkIn" | "checkOut" | "adults">;
    currentValues: Partial<{ checkIn: string; checkOut: string; adults: number }>;
  } | null;
  onAvailabilitySubmit: (values: { checkIn: string; checkOut: string; adults: number }) => void;
  status: "idle" | "sending" | "error";
  onRetry?: () => void;
  error?: { message: string; retryable: boolean } | null;
  sessionId?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  activeAvailabilityPrompt,
  onAvailabilitySubmit,
  status,
  onRetry,
  error,
  sessionId,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "helpful" | "not_helpful">>({});

  const handleFeedback = async (msgId: string, rating: "helpful" | "not_helpful") => {
    setFeedbackGiven((prev) => ({ ...prev, [msgId]: rating }));
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: msgId,
          sessionId: sessionId || "anon",
          rating,
        }),
      });
    } catch {
      // Feedback is non-blocking
    }
  };

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
      className="space-y-6 pb-6"
    >
      {messages.map((msg, index) => {
        const isUser = msg.role === "user";
        const isLastAssistant = !isUser && index === messages.length - 1;

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            {/* Message Bubble or Block */}
            <div
              className={`max-w-[85%] rounded-[8px] px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                isUser
                  ? "bg-[#1F5A5A] text-white"
                  : "border border-[#D8D5CE] bg-[#FFFFFF] text-[#1E2328]"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Source Provenance Indicators for Grounded Knowledge */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#F0EEE8] pt-2 text-[11px] text-[#66707A]">
                  <span className="font-medium">Sources:</span>
                  {msg.sources.map((s) => (
                    <span
                      key={s.id}
                      className="rounded bg-[#F0EEE8] px-1.5 py-0.5 font-mono text-[10px] text-[#1E2328]"
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Structured Room Results */}
            {msg.rooms && (
              <div className="mt-2 w-full max-w-xl">
                <RoomResults
                  rooms={msg.rooms}
                  query={msg.query}
                  isSuitabilityOnly={msg.type === "room_suitability"}
                />
              </div>
            )}

            {/* Active Inline Availability Form attached to the last prompt */}
            {isLastAssistant && activeAvailabilityPrompt && (
              <div className="mt-2 w-full max-w-xl">
                <AvailabilityForm
                  missingFields={activeAvailabilityPrompt.missingFields}
                  currentValues={activeAvailabilityPrompt.currentValues}
                  onSubmit={onAvailabilitySubmit}
                  disabled={status === "sending"}
                />
              </div>
            )}

            {/* Subtle Feedback buttons for Assistant messages placed after cards/forms */}
            {!isUser && (
              <div className="mt-2 flex w-full max-w-[85%] sm:max-w-[75%] items-center justify-between px-2 text-[11px] text-[#66707A]">
                <span className="text-[10px] tracking-wide">Was this answer helpful?</span>
                {feedbackGiven[msg.id] ? (
                  <span className="text-[10px] text-emerald-700 font-medium">Thank you for your feedback</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(msg.id, "helpful")}
                      className="hover:text-[#1F5A5A] px-1 py-0.5 rounded transition text-[11px]"
                      aria-label="Helpful"
                    >
                      Helpful
                    </button>
                    <span>&bull;</span>
                    <button
                      onClick={() => handleFeedback(msg.id, "not_helpful")}
                      className="hover:text-[#9A3412] px-1 py-0.5 rounded transition text-[11px]"
                      aria-label="Not helpful"
                    >
                      Not helpful
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Sending / Processing indicator */}
      {status === "sending" && (
        <div className="flex items-center gap-2 text-xs text-[#66707A]" aria-label="Assistant is checking information">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1F5A5A]" />
          <span>Checking hotel records...</span>
        </div>
      )}

      {/* Inline Error State with Retry Button */}
      {status === "error" && error && (
        <div
          role="alert"
          className="rounded-[8px] border border-[#9A3412] bg-[#FDF2EC] p-3 text-sm text-[#9A3412]"
        >
          <p className="font-semibold">Unable to complete request</p>
          <p className="mt-0.5 text-xs">{error.message}</p>
          {error.retryable && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-[4px] border border-[#9A3412] bg-white px-2.5 py-1 text-xs font-medium text-[#9A3412] hover:bg-[#FDF2EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3]"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
};
