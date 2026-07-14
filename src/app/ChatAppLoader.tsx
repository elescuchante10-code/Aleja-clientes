"use client";

import dynamic from "next/dynamic";

const ChatApp = dynamic(() => import("./ChatApp"), { ssr: false });

export default function ChatAppLoader() {
  return <ChatApp />;
}
