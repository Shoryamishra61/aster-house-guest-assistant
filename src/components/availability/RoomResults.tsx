import React from "react";
import { RoomResult } from "@/shared/contracts";

interface RoomResultsProps {
  rooms: RoomResult[];
  query?: { checkIn: string; checkOut: string; adults: number; nights: number };
  isSuitabilityOnly?: boolean;
}

export const RoomResults: React.FC<RoomResultsProps> = ({
  rooms,
  query,
  isSuitabilityOnly = false,
}) => {
  if (rooms.length === 0) {
    return (
      <div className="my-3 rounded-[8px] border border-[#D8D5CE] bg-[#F0EEE8] p-4 text-[#1E2328]">
        <h3 className="text-sm font-semibold text-[#1E2328]">
          No rooms currently available
        </h3>
        <p className="mt-1 text-xs text-[#66707A]">
          No rooms match those dates and guest criteria. Please try alternate dates or contact our front desk at +1 (555) 328-9100.
        </p>
      </div>
    );
  }

  return (
    <div
      className="my-3 space-y-3"
      role="region"
      aria-label={isSuitabilityOnly ? "Room suitability options" : "Available rooms list"}
    >
      {rooms.map((room) => (
        <article
          key={room.roomTypeId}
          className="rounded-[8px] border border-[#D8D5CE] bg-[#FFFFFF] p-4 text-[#1E2328] transition-colors hover:border-[#66707A]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-base font-semibold text-[#1E2328]">{room.name}</h4>
            <div className="text-right">
              <span className="text-base font-bold text-[#1E2328]">
                ${room.nightlyRate}
              </span>
              <span className="text-xs text-[#66707A]"> / night</span>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#66707A]">
            <span>{room.bedConfiguration}</span>
            <span>·</span>
            <span>Max {room.maxOccupancy} Guests</span>
            {!isSuitabilityOnly && room.nights > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-[#1E2328]">
                  Total: ${room.totalPrice} ({room.nights} night{room.nights > 1 ? "s" : ""})
                </span>
              </>
            )}
          </div>

          {room.amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#F0EEE8] pt-2.5">
              {room.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded bg-[#F0EEE8] px-2 py-0.5 text-[11px] font-medium text-[#1E2328]"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}

          {!isSuitabilityOnly && (
            <div className="mt-3 flex items-center justify-end">
              <a
                href="tel:+15553289100"
                className="rounded-[6px] border border-[#1F5A5A] px-3 py-1.5 text-xs font-semibold text-[#1F5A5A] hover:bg-[#1F5A5A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3]"
                aria-label={`Call front desk to reserve ${room.name}`}
              >
                Call Front Desk to Reserve
              </a>
            </div>
          )}
        </article>
      ))}
    </div>
  );
};
