"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import moment from "moment";

export default function Home() {
  const [messages, setMessages] = useState<
    { role: string; content: string; timestamp?: number }[]
  >([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const savedMessages = localStorage.getItem("aria_chat_history");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Mensaje inicial
      const initialMessage = {
        role: "assistant",
        content:
          "Hola, soy Alejandra, el sistema de inteligencia artificial de Paz Ortega.\n[IA · no soy una persona]\n\nPaz Ortega ayuda a empresas y personas a usar la IA de forma ordenada y con propósito: diseñamos la política, construimos las plataformas y las acompañamos.\n\nAntes de contarte qué hacemos, me gustaría entender qué te trae por aquí. ¿Me cuentas un poco?",
        timestamp: Date.now(),
      };
      setMessages([initialMessage]);
      localStorage.setItem("aria_chat_history", JSON.stringify([initialMessage]));
    }
  }, []);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage = { role: "user", content: inputValue, timestamp: Date.now() };
    const updatedMessages = [...messages, newMessage];

    setMessages(updatedMessages);
    localStorage.setItem("aria_chat_history", JSON.stringify(updatedMessages));
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
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await response.json();
      const assistantMessage = { role: "assistant", content: data.respuesta, timestamp: Date.now() };
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      localStorage.setItem("aria_chat_history", JSON.stringify([...updatedMessages, assistantMessage]));
    } catch (error) {
      console.error("Error al enviar el mensaje:", error);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F1EA]">
      <header className="fixed top-0 w-full bg-white p-4 shadow-md z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-lg font-semibold">Paz Ortega · Alejandra</h1>
          <span className="bg-teal-500 text-white px-2 py-1 rounded-full text-sm">● IA activa · no soy una persona</span>
        </div>
      </header>
      <main className="container mx-auto flex flex-col items-center justify-center pt-24 pb-16">
        <div className="w-full max-w-md px-4">
          <div className="space-y-4 mb-8">
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
                      ? "bg-teal-500 text-white rounded-tr-none"
                      : "bg-white border border-gray-200 rounded-tl-none"
                  }`}
                >
                  {msg.content.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  {moment(msg.timestamp).format("HH:mm")}
                </span>
              </div>
            ))}
            {loading && (
              <div className={`flex flex-col items-start`}>
                <div
                  className={`p-3 rounded-lg max-w-[80%] bg-white border border-gray-200 rounded-tl-none`}
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
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex flex-col space-y-2"
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Cuéntame sobre tu empresa..."
              rows={1}
              maxLength={500}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 resize-y"
            ></textarea>
            <button
              type="submit"
              className="bg-teal-500 text-white px-4 py-2 rounded-lg self-end hover:bg-teal-600 transition-colors"
            >
              Enviar
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
