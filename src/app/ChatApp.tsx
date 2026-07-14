"use client";

import { useEffect, useRef, useState } from "react";
import Image from 'next/image';

export default function ChatApp() {
  const [messages, setMessages] = useState<
    { role: string; content: string; timestamp?: number }[]
  >(() => {
    const savedMessages = localStorage.getItem("aria_chat_history");
    if (savedMessages) {
      return JSON.parse(savedMessages);
    } else {
      // Mensaje inicial
      return [
        {
          role: "assistant",
          content:
            "Hola, soy Alejandra, el sistema de inteligencia artificial de Paz Ortega.\n\nPaz Ortega ayuda a empresas y personas a usar la IA de forma ordenada y con propósito: diseñamos la política, construimos las plataformas y las acompañamos.\n\nAntes de contarte qué hacemos, me gustaría entender qué te trae por aquí. ¿Me cuentas un poco?",
          timestamp: Date.now(),
        },
      ];
    }
  });
  const [sessionId] = useState<string>(() => {
    const existing = localStorage.getItem("aria_session_id");
    if (existing) return existing;
    const nuevo = crypto.randomUUID();
    localStorage.setItem("aria_session_id", nuevo);
    return nuevo;
  });
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    localStorage.setItem("aria_chat_history", JSON.stringify(messages));
  }, [messages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, analyzing]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage = { role: "user", content: inputValue, timestamp: Date.now() };
    const updatedMessages = [...messages, newMessage];

    setMessages(updatedMessages);
    setInputValue("");

    setLoading(true);

    // Simular delay
    const delay = Math.min(1800, 800 + (newMessage.content.length * 500) / 20);
    setTimeout(() => {
      setAnalyzing(true);
    }, delay);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await response.json();
      const assistantMessage = { role: "assistant", content: data.respuesta, timestamp: Date.now() };
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error al enviar el mensaje:", error);
      const errorMessage = {
        role: "assistant",
        content: 'Tuve un problema para responder justo ahora. ¿Puedes intentar de nuevo en un momento?',
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  function formatTime(timestamp?: number) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  return (
    <div className="flex flex-col h-dvh bg-crema">
      <header className="sticky top-0 w-full bg-white p-4 shadow-md z-50">
        <div className="w-full max-w-lg mx-auto flex justify-between items-center px-2">
          <div className="flex items-center space-x-3">
            <Image
              src="/alejandra-avatar.png"
              alt="Alejandra Avatar"
              width={44}
              height={44}
              className="rounded-full object-cover"
            />
            <div>
              <h1 className="font-semibold">Alejandra</h1>
              <p className="text-sm text-gris">Asistente de Inteligencia Artificial de Paz Ortega</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <a href="https://www.instagram.com/soluciones_deia/" target="_blank" rel="noopener noreferrer" className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gris">IG</a>
            <a href="https://www.tiktok.com/@soluciones.de.ia" target="_blank" rel="noopener noreferrer" className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gris">TT</a>
            <a href="https://paz-ortega-ia.vercel.app/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <Image
                src="/paz-ortega-logo.png"
                alt="Paz Ortega"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-lg mx-auto space-y-4 px-2 py-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`p-3 rounded-lg max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-naranja text-white rounded-tr-none"
                    : "bg-morado text-white rounded-tl-none"
                }`}
              >
                {msg.content.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <span className="text-xs text-gris">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          ))}
          {loading && (
            <div className={`flex flex-col items-start`}>
              <div
                className={`p-3 rounded-lg max-w-[80%] bg-morado text-white rounded-tl-none`}
              >
                {analyzing ? "Analizando..." : (
                  <div className="flex space-x-1">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>
      <div className="w-full bg-beige-oscuro z-50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="w-full max-w-lg mx-auto px-2 py-3"
        >
          <div className="flex items-end space-x-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Cuéntame sobre tu empresa..."
              rows={1}
              maxLength={500}
              className="w-full p-3 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-morado resize-none bg-white text-sm placeholder:text-gris"
            ></textarea>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className={`shrink-0 w-11 h-11 flex items-center justify-center bg-morado text-white rounded-full hover:bg-purple-700 transition-colors ${!inputValue.trim() && 'opacity-50 cursor-not-allowed'}`}
            >
              ➤
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
