import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractAiSummary(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      mainSentence: "AI тайлбар уншигдсангүй.",
      skills: [],
      summary: content || "Хариу алга.",
    };
  }
}

export const POST = async (req: NextRequest) => {
  try {
    await connectMongoDb();

    const formData = await req.formData();
    const cvUrl = formData.get("cvUrl") as string;
    const jobId = formData.get("jobId") as string;

    if (!cvUrl || !jobId) {
      return NextResponse.json(
        { success: false, message: "CV URL болон jobId шаардлагатай." },
        { status: 400 }
      );
    }

    const response = await axios.get(cvUrl, { responseType: "arraybuffer" });
    console.log("response", response);
    if (!response.data) {
      return NextResponse.json(
        { success: false, message: "CV файлыг уншиж чадсангүй." },
        { status: 400 }
      );
    }
    const parsedPdf = await pdfParse(response.data);
    const text = parsedPdf.text;

    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    const matchedSkills = job.requirements.filter((req: string) =>
      text.toLowerCase().includes(req.toLowerCase())
    );

    const matchPercentage = Math.round(
      (matchedSkills.length / job.requirements.length) * 100
    );

    const prompt = `Доорх CV-г уншаад "${
      job.title
    }" ажлын шаардлагад хэрхэн нийцэж байгааг 3 хэсэгт ангилж монгол хэл дээр гарга:
1. Үндсэн шалтгаан (mainSentence)
2. Таарсан ур чадварууд (skills)
3. Туршлагын товч тайлбар (summary)

CV:
${text}

Ажлын шаардлага:
${job.requirements.join(", ")}`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const aiContent = aiResponse.choices[0].message.content ?? "";
    const aiSummary = extractAiSummary(aiContent);

    const status = matchPercentage >= 70 ? "shortlisted" : "pending";

    const application = await ApplicationModel.create({
      jobId,
      cvUrl,
      extractedText: text,
      matchPercentage,
      matchedSkills,
      bookmarked: false,
      aiSummary,
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
        message: "Серверийн алдаа гарлаа. Дахин оролдоно уу.",
      },
      { status: 500 }
    );
  }
};
