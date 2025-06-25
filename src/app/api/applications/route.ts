import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractAiSummary(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      matchPercentage: 0,
      matchedSkills: [],
      summary: content || "AI тайлбар уншигдсангүй.",
    };
  }
}

export const POST = async (req: NextRequest) => {
  try {
    await connectMongoDb();

    const formData = await req.formData();
    const cvUrl = formData.get("cvUrl") as string;
    const jobId = formData.get("jobId") as string;
    const cvText = formData.get("cvText") as string;

    if (!cvUrl || !jobId || !cvText) {
      return NextResponse.json(
        { success: false, message: "CV URL, CV текст, jobId шаардлагатай." },
        { status: 400 }
      );
    }

    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    const prompt = `
Доорх CV-г уншаад "${
      job.title
    }" ажлын шаардлагад хэрхэн нийцэж байгааг дараах JSON хэлбэрээр гарга:

{
  "matchPercentage": [0-100],
  "matchedSkills": ["..."],
  "summary": "Товч тайлбар..."
}

CV текст:
${cvText}

Ажлын шаардлага:
${job.requirements.join(", ")}
`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const aiContent = aiResponse.choices[0].message?.content ?? "";
    const aiResult = extractAiSummary(aiContent);

    const status = aiResult.matchPercentage >= 70 ? "shortlisted" : "pending";

    const application = await ApplicationModel.create({
      jobId,
      cvUrl,
      extractedText: cvText,
      matchPercentage: aiResult.matchPercentage,
      matchedSkills: aiResult.matchedSkills,
      bookmarked: false,
      aiSummary: {
        mainSentence: aiResult.summary,
        skills: aiResult.matchedSkills,
        summary: aiResult.summary,
      },
      status,
    });

    return NextResponse.json(
      { success: true, data: application },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing application:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Серверийн алдаа: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
};
export const GET = async (_req: NextRequest) => {
  try {
    await connectMongoDb();
    const applications = await ApplicationModel.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Серверийн алдаа: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
};
