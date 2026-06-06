import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export default function LoadingSpinner({
  className = "",
  size = 24,
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2
        className="animate-spin text-primary"
        size={size}
      />
    </div>
  );
}
