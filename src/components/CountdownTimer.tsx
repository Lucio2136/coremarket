import React, { useEffect, useState } from "react";

interface CountdownTimerProps {
  closesAt: string;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  closesAt,
  className = "",
}) => {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const destination = new Date(closesAt).getTime();
      const distance = destination - now;

      if (distance < 0) {
        setIsExpired(true);
        setTimeLeft("Market closed");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [closesAt]);

  return (
    <span className={`text-sm font-semibold ${isExpired ? "text-red-600" : "text-gray-600"} ${className}`}>
      {timeLeft}
    </span>
  );
};
