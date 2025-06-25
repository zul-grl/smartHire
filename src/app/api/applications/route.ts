import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";
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

    if (!cvUrl || !jobId) {
      return NextResponse.json(
        { success: false, message: "CV URL болон jobId шаардлагатай." },
        { status: 400 }
      );
    }

    console.log("Received cvUrl:", cvUrl, "jobId:", jobId);

    // PDF татаж авах (жишээ нь fetch эсвэл axios ашиглаж болно)
    const response = await fetch(cvUrl);
    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `CV татаж чадсангүй: ${response.status} - ${response.statusText}`,
        },
        { status: 400 }
      );
    }
    console.log("response", response);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // pdf2json ашиглан текст гаргах
    const pdfParser = new PDFParser();
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => {
        reject(new Error("PDF parsing error: " + errData.parserError));
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        if (!pdfData.Pages || pdfData.Pages.length === 0) {
          reject(new Error("PDF дээр текст олдсонгүй."));
          return;
        }

        const extractedText = pdfData.Pages.map((page) =>
          page.Texts.map((textObj) =>
            decodeURIComponent(textObj.R.map((r) => r.T).join(""))
          ).join(" ")
        ).join(" ");

        if (!extractedText || extractedText.trim().length === 0) {
          reject(new Error("PDF дээр уншигдах текст олдсонгүй."));
          return;
        }

        resolve(extractedText.trim());
      });

      pdfParser.parseBuffer(buffer);
    });

    // Текст байгаа эсэхийг шалгах
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "CV файлд уншигдах текст олдсонгүй." },
        { status: 400 }
      );
    }

    console.log("Extracted text:", text);

    // Ажлын зар авах
    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    // AI-д prompt үүсгэх
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
${text}

Ажлын шаардлага:
${job.requirements.join(", ")}
`;

    // AI хариу авах
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const aiContent = aiResponse.choices[0].message.content ?? "";
    const aiResult = extractAiSummary(aiContent);

    const status = aiResult.matchPercentage >= 70 ? "shortlisted" : "pending";

    // Өргөдөл үүсгэх
    const application = await ApplicationModel.create({
      jobId,
      cvUrl,
      extractedText: text,
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
