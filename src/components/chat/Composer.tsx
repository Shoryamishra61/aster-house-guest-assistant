import React, { useState, useRef, useEffect } from "react";

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  disabled = false,
  placeholder = "Ask about rooms, amenities, policies, or dates...",
}) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="sticky bottom-0 border-t border-[#D8D5CE] bg-[#FFFFFF] p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <label htmlFor="chat-composer" className="sr-only">
            Your message
          </label>
          <textarea
            id="chat-composer"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            aria-label="Your message to Aster House assistant"
            className="block max-h-32 min-h-[44px] w-full resize-none rounded-[6px] border border-[#D8D5CE] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#1E2328] placeholder-[#66707A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
          className="flex h-[44px] items-center justify-center rounded-[6px] bg-[#1F5A5A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#174747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
};
