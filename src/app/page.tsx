"use client";

import React, { useRef, useEffect } from "react";
import { Header } from "@/components/system/Header";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { useChat } from "@/hooks/useChat";

export default function GuestAssistantPage() {
  const { state, sendMessage, retryLast } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.status]);

  const handlePromptSelect = (promptText: string) => {
    sendMessage(promptText);
  };

  const handleAvailabilitySubmit = (values: {
    checkIn: string;
    checkOut: string;
    adults: number;
  }) => {
    sendMessage(
      `Check availability from ${values.checkIn} to ${values.checkOut} for ${values.adults} guest${values.adults > 1 ? "s" : ""}`,
      values
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5F0]">
      {/* Top Header */}
      <Header />

      {/* Main Conversation Container */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6">
        {state.messages.length === 0 ? (
          <EmptyState onSelectPrompt={handlePromptSelect} />
        ) : (
          <div className="flex-1">
            <MessageList
              messages={state.messages}
              activeAvailabilityPrompt={state.activeAvailabilityPrompt}
              onAvailabilitySubmit={handleAvailabilitySubmit}
              status={state.status}
              error={state.error}
              onRetry={retryLast}
              sessionId={state.sessionId}
            />
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Sticky Composer */}
      <Composer
        onSend={(text) => sendMessage(text)}
        disabled={state.status === "sending"}
      />
    </div>
  );
}
