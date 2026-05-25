export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  hasOpenAIKey,
  pingOpenAI,
  resolveOpenAIModel,
  resolveOpenAICommentsModel,
} from "@/app/lib/openaiChat";
import { getSopExtractModeLabel } from "@/app/lib/sopExtractMode";
import { aiDebugLog, isAiDebugEnabled } from "@/app/lib/aiDebugLog";

export async function GET() {
  aiDebugLog("health", "GET /api/Ai/health", { hasKey: hasOpenAIKey() });
  const ping = await pingOpenAI();
  return NextResponse.json({
    sopExtractMode: getSopExtractModeLabel(),
    openai: {
      hasKey: hasOpenAIKey(),
      extractModel: resolveOpenAIModel(),
      commentsModel: resolveOpenAICommentsModel(),
      model: resolveOpenAIModel(),
      apiMode: process.env.OPENAI_API_MODE || "responses",
      debugLogging: isAiDebugEnabled(),
      ...ping,
    },
  });
}
