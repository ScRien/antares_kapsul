import React from "react";

export default function StatusIndicator({
  commandStatus,
  isHardwareOffline = false,
}) {
  const getStatusColor = () => {
    if (isHardwareOffline) return "bg-amber-50 border-amber-400";
    if (commandStatus?.includes("⏳")) return "bg-yellow-50 border-yellow-200";
    if (commandStatus?.includes("✅")) return "bg-green-50 border-green-200";
    if (commandStatus?.includes("❌")) return "bg-red-50 border-red-200";
    return "bg-white border-gray-200";
  };

  const showOffline = isHardwareOffline;
  const showCommand = !!commandStatus;

  if (!showOffline && !showCommand) return null;

  return (
    <div
      className={`fixed top-20 right-5 shadow-lg p-4 rounded-lg text-sm font-medium z-50 max-w-xs border-2 ${getStatusColor()} transition-all space-y-1`}
    >
      {showOffline && (
        <div className="text-amber-800 font-semibold">
          Donanım çevrimdışı
        </div>
      )}
      {showCommand && (
        <div className={showOffline ? "text-gray-600 text-xs pt-1 border-t border-amber-200" : ""}>
          {commandStatus}
        </div>
      )}
    </div>
  );
}
