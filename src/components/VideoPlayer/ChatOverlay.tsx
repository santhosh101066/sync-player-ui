import React from "react";
import type { ChatOverlayProps } from "../../types/videoPlayer.types";

export const ChatOverlay: React.FC<ChatOverlayProps> = ({ messages }) => {
    return (
        <div className="absolute bottom-20 right-5 w-[280px] max-w-[70%] max-h-[60%] flex flex-col justify-end items-end gap-2 pointer-events-none z-20 [mask-image:linear-gradient(to_bottom,transparent,black_15%)]">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className="bg-[#141414]/60 backdrop-blur-[4px] border border-white/10 py-1.5 px-3 rounded-[12px_12px_2px_12px] text-zinc-200 text-sm shadow-sm animate-in slide-in-from-right-5 duration-200 max-w-full break-words"
                >
                    <span
                        className="font-semibold text-xs mr-1.5 uppercase opacity-90"
                        style={{ color: msg.color }}
                    >
                        {msg.nick}
                    </span>
                    <span className="text-white">{msg.text}</span>
                </div>
            ))}
        </div>
    );
};
