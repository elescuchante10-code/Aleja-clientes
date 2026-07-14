import { NextResponse } from "next/server";
import { deepseek, DEEPSEEK_MODEL } from "@/lib/deepseek";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      throw new Error("Invalid message format");
    }

    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 600,
    });

    return NextResponse.json({ respuesta: response.choices[0].message.content });
  } catch (error) {
    console.error("Error en la llamada a DeepSeek:", error);
    return new NextResponse(
      JSON.stringify({ error: "Ocurrió un error al procesar tu solicitud" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
