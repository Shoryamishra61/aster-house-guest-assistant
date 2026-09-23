import React from "react";

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const starters = [
    "What time is check-in?",
    "Is breakfast included?",
    "Check room availability",
  ];

  return (
    <section
      aria-label="Welcome and conversation starters"
      className="my-auto py-8 text-center"
    >
      <h2 className="text-xl font-medium tracking-tight text-[#1E2328] sm:text-2xl">
        How can I help with your stay?
      </h2>
      <p className="mt-2 text-sm text-[#66707A]">
        Ask about check-in, amenities, room options, policies, or availability.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {starters.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onSelectPrompt(starter)}
            className="rounded-[6px] border border-[#D8D5CE] bg-[#FFFFFF] px-3.5 py-2 text-sm font-medium text-[#1E2328] transition-colors hover:border-[#1F5A5A] hover:text-[#1F5A5A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3]"
          >
            {starter}
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs text-[#66707A]">
        Information is grounded in Aster House records. If a detail is unsupported, I&apos;ll say so rather than guess.
      </p>
    </section>
  );
};
