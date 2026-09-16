import React from "react";
import { Check } from "lucide-react";

interface ProgressBarProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Style" },
  { id: 3, label: "Format" },
  { id: 4, label: "Generate" },
  { id: 5, label: "Print-Ready" },
];

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-10 px-4">
      <div className="relative flex items-center justify-between">
        {/* Background track line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[#E5DFD3] -z-0" />

        {/* Active track line */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#1C1917] transition-all duration-500 -z-0"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                  isDone
                    ? "bg-[#1C1917] text-[#F8F5EE]"
                    : isCurrent
                    ? "bg-[#A34825] text-white ring-4 ring-[#A34825]/20 font-semibold"
                    : "bg-[#FDFBF7] border-2 border-[#D6CEBE] text-[#78716C]"
                }`}
              >
                {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
              </div>
              <span
                className={`text-[11px] font-medium mt-1.5 whitespace-nowrap ${
                  isCurrent
                    ? "text-[#1C1917] font-semibold"
                    : isDone
                    ? "text-[#44403C]"
                    : "text-[#A8A29E]"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
