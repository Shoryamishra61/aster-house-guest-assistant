import React, { useState } from "react";

interface AvailabilityFormProps {
  missingFields?: Array<"checkIn" | "checkOut" | "adults">;
  currentValues?: Partial<{ checkIn: string; checkOut: string; adults: number }>;
  onSubmit: (values: { checkIn: string; checkOut: string; adults: number }) => void;
  disabled?: boolean;
}

export const AvailabilityForm: React.FC<AvailabilityFormProps> = ({
  currentValues,
  onSubmit,
  disabled = false,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState(currentValues?.checkIn || todayStr);
  const [checkOut, setCheckOut] = useState(currentValues?.checkOut || tomorrowStr);
  const [adults, setAdults] = useState<number>(currentValues?.adults || 2);
  const [fieldErrors, setFieldErrors] = useState<{
    checkIn?: string;
    checkOut?: string;
    adults?: string;
  }>({});

  const validate = () => {
    const errors: { checkIn?: string; checkOut?: string; adults?: string } = {};

    if (!checkIn) {
      errors.checkIn = "Check-in date is required.";
    } else if (checkIn < todayStr) {
      errors.checkIn = "Check-in date cannot be in the past.";
    }

    if (!checkOut) {
      errors.checkOut = "Check-out date is required.";
    } else if (checkIn && checkOut <= checkIn) {
      errors.checkOut = "Check-out must be after check-in.";
    }

    if (!adults || adults < 1) {
      errors.adults = "Guest count must be at least 1.";
    } else if (adults > 5) {
      errors.adults = "Maximum 5 guests per room. Contact front desk for group bookings.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ checkIn, checkOut, adults: Number(adults) });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="my-3 rounded-[8px] border border-[#D8D5CE] bg-[#FFFFFF] p-4 text-[#1E2328]"
      aria-label="Room availability search form"
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Check-in */}
        <div>
          <label htmlFor="form-checkin" className="block text-xs font-semibold text-[#1E2328]">
            Check-in date
          </label>
          <input
            id="form-checkin"
            type="date"
            min={todayStr}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            disabled={disabled}
            aria-describedby={fieldErrors.checkIn ? "error-checkin" : undefined}
            className={`mt-1 block w-full rounded-[6px] border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] ${
              fieldErrors.checkIn ? "border-[#9A3412] bg-[#FDF2EC]" : "border-[#D8D5CE] bg-[#FFFFFF]"
            }`}
          />
          {fieldErrors.checkIn && (
            <p id="error-checkin" className="mt-1 text-xs text-[#9A3412]">
              {fieldErrors.checkIn}
            </p>
          )}
        </div>

        {/* Check-out */}
        <div>
          <label htmlFor="form-checkout" className="block text-xs font-semibold text-[#1E2328]">
            Check-out date
          </label>
          <input
            id="form-checkout"
            type="date"
            min={checkIn || todayStr}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            disabled={disabled}
            aria-describedby={fieldErrors.checkOut ? "error-checkout" : undefined}
            className={`mt-1 block w-full rounded-[6px] border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] ${
              fieldErrors.checkOut ? "border-[#9A3412] bg-[#FDF2EC]" : "border-[#D8D5CE] bg-[#FFFFFF]"
            }`}
          />
          {fieldErrors.checkOut && (
            <p id="error-checkout" className="mt-1 text-xs text-[#9A3412]">
              {fieldErrors.checkOut}
            </p>
          )}
        </div>

        {/* Adults */}
        <div>
          <label htmlFor="form-adults" className="block text-xs font-semibold text-[#1E2328]">
            Guests (Adults)
          </label>
          <select
            id="form-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            disabled={disabled}
            aria-describedby={fieldErrors.adults ? "error-adults" : undefined}
            className={`mt-1 block w-full rounded-[6px] border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] ${
              fieldErrors.adults ? "border-[#9A3412] bg-[#FDF2EC]" : "border-[#D8D5CE] bg-[#FFFFFF]"
            }`}
          >
            <option value={1}>1 Guest</option>
            <option value={2}>2 Guests</option>
            <option value={3}>3 Guests</option>
            <option value={4}>4 Guests</option>
            <option value={5}>5 Guests</option>
          </select>
          {fieldErrors.adults && (
            <p id="error-adults" className="mt-1 text-xs text-[#9A3412]">
              {fieldErrors.adults}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-[#F0EEE8]">
        <span className="text-xs text-[#66707A]">
          Direct reservation check with hotel inventory
        </span>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-[6px] bg-[#1F5A5A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#174747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B66C3] disabled:opacity-50"
        >
          Check availability
        </button>
      </div>
    </form>
  );
};
