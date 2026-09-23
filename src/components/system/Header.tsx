import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="border-b border-[#D8D5CE] bg-[#FFFFFF] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-[#1E2328]">
              Aster House
            </h1>
            <span className="rounded bg-[#F0EEE8] px-2 py-0.5 text-xs font-medium text-[#66707A]">
              Guest Assistance
            </span>
          </div>
          <p className="text-xs text-[#66707A]">
            142 Walnut Street, Downtown Historic District
          </p>
        </div>
        <div className="text-right">
          <a
            href="tel:+15553289100"
            className="text-xs font-medium text-[#1F5A5A] hover:underline focus-visible:rounded"
            aria-label="Call front desk at +1 (555) 328-9100"
          >
            Front Desk: +1 (555) 328-9100
          </a>
          <div className="flex items-center justify-end gap-2 text-[11px] text-[#66707A]">
            <span>24/7 Service</span>
            <span>&bull;</span>
            <a href="/ops" className="hover:text-[#1E2328] hover:underline" title="Operator Control Plane">
              Ops
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
