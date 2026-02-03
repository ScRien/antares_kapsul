import React from "react";

export default function StatusIndicator({ commandStatus }) {
  const getStatusColor = () => {
    if (commandStatus.includes("gonderi") || commandStatus.includes("gonderil"))
      return "bg-yellow-50 border-yellow-200";
    if (commandStatus.includes("basarili"))
      return "bg-green-50 border-green-200";
    if (commandStatus.includes("basarisiz")) return "bg-red-50 border-red-200";
    return "bg-white border-gray-200";
  };

  if (!commandStatus) return null;

  return (
    <div
      className={`fixed top-20 right-5 shadow-lg p-4 rounded-lg text-sm font-medium z-50 max-w-xs border-2 ${getStatusColor()} transition-all`}
    >
      {commandStatus}
    </div>
  );
}
