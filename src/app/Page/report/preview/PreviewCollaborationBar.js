"use client";

function initialsFromName(name) {
  const parts = String(name || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function ParticipantAvatar({ participant, size = "sm" }) {
  const dim =
    size === "xs"
      ? "w-6 h-6 text-[8px]"
      : size === "sm"
        ? "w-8 h-8 text-[10px]"
        : "w-9 h-9 text-[11px]";
  const ring =
    participant.location === "onlyoffice"
      ? "ring-2 ring-indigo-500"
      : "ring-2 ring-emerald-500";

  if (participant.image) {
    return (
      <img
        src={participant.image}
        alt={participant.name || "User"}
        title={`${participant.name || "User"}${participant.location === "onlyoffice" ? " · OnlyOffice" : " · Preview"}`}
        className={`${dim} rounded-full object-cover border-2 border-white shadow-sm ${ring}`}
      />
    );
  }

  return (
    <span
      title={`${participant.name || "User"}${participant.location === "onlyoffice" ? " · OnlyOffice" : " · Preview"}`}
      className={`${dim} inline-flex items-center justify-center rounded-full bg-slate-700 text-white font-semibold border-2 border-white shadow-sm ${ring}`}
    >
      {initialsFromName(participant.name)}
    </span>
  );
}

/**
 * Live collaborators — top-right profile stack (WebSocket presence).
 */
export default function PreviewCollaborationBar({
  participants = [],
  wsConnected = false,
  maxVisible = 5,
  /** Icon-only status dot; hide "Live" / "N online" labels */
  compact = false,
  /** Stack live dot + avatars vertically (OnlyOffice corner) */
  vertical = false,
  /** Smaller footprint for corner overlay */
  mini = false,
}) {
  const visible = participants.slice(0, maxVisible);
  const overflow = Math.max(0, participants.length - maxVisible);

  const avatarSize = mini ? "xs" : "sm";

  return (
    <div
      className={`pointer-events-auto flex bg-white/95 border border-slate-200 shadow-sm ${
        vertical
          ? `flex-col items-center rounded-xl ${mini ? "gap-1 px-1 py-1" : "gap-1.5 px-2 py-2"}`
          : "flex-row items-center gap-2 rounded-full px-2 py-1.5"
      }`}
      aria-label="Collaborators in this report"
    >
      <span
        className={`inline-block rounded-full shrink-0 ${
          mini ? "w-1.5 h-1.5" : "w-2.5 h-2.5"
        } ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
        title={wsConnected ? "Live — WebSocket connected" : "Offline — refresh page"}
        aria-hidden="true"
      />
      {!compact && (
        <span
          className={`text-[10px] font-semibold pr-0.5 ${
            wsConnected ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {wsConnected ? "Live" : "Offline"}
        </span>
      )}
      <div
        className={
          vertical
            ? `flex flex-col items-center ${mini ? "-space-y-1.5" : "-space-y-2"}`
            : "flex items-center -space-x-2"
        }
      >
        {visible.map((p) => (
          <ParticipantAvatar key={p.clientId} participant={p} size={avatarSize} />
        ))}
        {overflow > 0 && (
          <span
            className={`inline-flex items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 border-2 border-white ring-2 ring-slate-200 ${
              mini ? "w-6 h-6 text-[8px]" : "w-8 h-8 text-[10px]"
            }`}
          >
            +{overflow}
          </span>
        )}
      </div>
      {!compact && participants.length > 0 && (
        <span className="text-[10px] text-slate-500 font-medium pr-1 hidden sm:inline">
          {participants.length} online
        </span>
      )}
    </div>
  );
}
