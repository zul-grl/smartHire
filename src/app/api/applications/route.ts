import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

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
    // Connect to MongoDB
    await connectMongoDb();

    // Parse form data
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

    // Verify Cloudinary credentials
    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error("Cloudinary credentials missing:", {
        apiKey: CLOUDINARY_API_KEY,
        apiSecret: CLOUDINARY_API_SECRET,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Cloudinary тохиргооны алдаа: API key эсвэл secret байхгүй.",
        },
        { status: 500 }
      );
    }

    // Fetch PDF from Cloudinary with authentication
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(
        `${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`
      ).toString("base64")}`,
    };

    const response = await axios
      .get(cvUrl, {
        responseType: "arraybuffer",
        headers,
      })
      .catch((error) => {
        console.error("Axios error fetching PDF:", {
          status: error.response?.status,
          data: error.response?.data?.toString() || "No response data",
          message: error.message,
        });
        throw new Error(
          `Failed to fetch PDF: ${
            error.response?.status || "Unknown status"
          } - ${error.response?.data?.error?.message || error.message}`
        );
      });

    if (!response.data) {
      return NextResponse.json(
        { success: false, message: "CV файлыг уншиж чадсангүй." },
        { status: 400 }
      );
    }

    // Parse PDF using pdf2json
    const pdfParser = new PDFParser();
    const buffer = Buffer.from(response.data);
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => {
        const errorMessage =
          errData.parserError instanceof Error
            ? errData.parserError.message
            : String(errData.parserError || "Unknown PDF parsing error");
        console.error("pdf2json parsing error:", errData);
        reject(new Error(errorMessage));
      });
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        const textContent = pdfData.Pages.map((page) =>
          page.Texts.map((text) => decodeURIComponent(text.R[0].T)).join(" ")
        ).join(" ");
        resolve(textContent);
      });
      pdfParser.parseBuffer(buffer);
    });

    // Find job
    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    // Match skills
    const matchedSkills = job.requirements.filter((req: string) =>
      text.toLowerCase().includes(req.toLowerCase())
    );

    const matchPercentage = Math.round(
      (matchedSkills.length / job.requirements.length) * 100
    );

    // Generate AI prompt
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

    // Get AI response
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    const aiContent = aiResponse.choices[0].message.content ?? "";
    const aiSummary = extractAiSummary(aiContent);

    // Determine status
    const status = matchPercentage >= 70 ? "shortlisted" : "pending";

    // Create application
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
        message: `Серверийн алдаа: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
};
