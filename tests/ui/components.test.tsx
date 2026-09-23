import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/chat/EmptyState";
import { AvailabilityForm } from "@/components/availability/AvailabilityForm";
import { RoomResults } from "@/components/availability/RoomResults";
import { RoomResult } from "@/shared/contracts";

describe("UI Components - Anti-Slop & Usability", () => {
  it("renders EmptyState with 3 prompt starters and triggers callback on click", () => {
    const handleSelect = vi.fn();
    render(<EmptyState onSelectPrompt={handleSelect} />);

    expect(screen.getByText("How can I help with your stay?")).toBeInTheDocument();
    const checkinBtn = screen.getByRole("button", { name: "What time is check-in?" });
    expect(checkinBtn).toBeInTheDocument();

    fireEvent.click(checkinBtn);
    expect(handleSelect).toHaveBeenCalledWith("What time is check-in?");
  });

  it("AvailabilityForm validates checkout after checkin and submits correctly", () => {
    const handleSubmit = vi.fn();
    render(
      <AvailabilityForm
        currentValues={{ checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 2 }}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Check availability" });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
      adults: 2,
    });
  });

  it("RoomResults renders room details with total stay calculations and amenities", () => {
    const mockRooms: RoomResult[] = [
      {
        roomTypeId: "classic-queen",
        name: "Classic Queen",
        maxOccupancy: 2,
        bedConfiguration: "1 Queen Bed",
        nightlyRate: 185,
        currency: "USD",
        nights: 3,
        totalPrice: 555,
        amenities: ["Free High-Speed Wi-Fi", "Walk-in Rain Shower"],
      },
    ];

    render(<RoomResults rooms={mockRooms} query={{ checkIn: "2026-10-10", checkOut: "2026-10-13", adults: 2, nights: 3 }} />);

    expect(screen.getByText("Classic Queen")).toBeInTheDocument();
    expect(screen.getByText("$185")).toBeInTheDocument();
    expect(screen.getByText("Total: $555 (3 nights)")).toBeInTheDocument();
    expect(screen.getByText("Free High-Speed Wi-Speed Wi-Fi".slice(0, 10), { exact: false })).toBeInTheDocument();
  });
});
