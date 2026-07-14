import OpenAI from "openai";

export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
