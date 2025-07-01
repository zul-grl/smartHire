import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type AiResult = {
  matchPercentage: number;
  matchedSkills: string[];
  summary: string;
  firstName: string;
  lastName: string;
};

function extractAiSummary(content: string) {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : content;
    const parsed = JSON.parse(jsonString);

    if (
      !parsed.matchPercentage ||
      !Array.isArray(parsed.matchedSkills) ||
      !parsed.summary ||
      !parsed.firstName ||
      !parsed.lastName
    ) {
      throw new Error(
        "JSON формат буруу: matchPercentage, matchedSkills, summary, firstName, lastName талбарууд шаардлагатай."
      );
    }
    return parsed;
  } catch (error) {
    return {
      matchPercentage: 0,
      matchedSkills: [],
      summary: `AI тайлбар уншигдсангүй: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      firstName: "Unknown",
      lastName: "Unknown",
    };
  }
}

const chunkText = (text: string, maxLength: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
};

// Gemini response авах функц
async function getGeminiResponse(prompt: string) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini AI алдаа:", error);
    return null;
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

    const chunks = chunkText(cvText, 20000);
    const aiResults: AiResult[] = [];

    for (const chunk of chunks) {
      const prompt = `
Таны үүрэг: Доорх CV текст болон ажлын шаардлагыг мэргэжлийн түвшинд шинжилж, дараах даалгаврыг биелүүлнэ үү:

1. Монгол (кирилл) болон англи хэлний холимог текстэд ажиллана. Монгол нэр, овог, тусгай үсэг ("ү", "ө", "ё" гэх мэт)-ийг зөв бичнэ. Техникийн нэр томьёог яг хэвээр хадгална.
2. CV-ээс нэр болон овог ялгаж авч "firstName" болон "lastName" талбарт оруулна. Хэрэв тодорхойгүй бол хоосон утга ("") өгнө.
3. Туршлагын хугацаа, төсөл, онцлох шийдлийг олж гаргана.
4. Ажлын шаардлага болон CV-д дурдагдсан ур чадваруудыг харьцуулж нийцсэн ур чадваруудыг жагсаана.
5. Товч, ойлгомжтой summary-г монгол хэлний дүрмийн алдаа багатай бичнэ.
6. Зөвхөн дараах JSON бүтэцтэй цэвэр JSON хариу гаргана:

{
  "matchPercentage": [0-100],
  "matchedSkills": ["ур чадвар1", "ур чадвар2", "..."],
  "summary": "Товч тайлбар: CV-ийн гол давуу тал ба ажлын шаардлагад нийцсэн тухай...",
  "firstName": "Нэр",
  "lastName": "Овог"
}

---

CV текст:
${chunk}

Ажлын шаардлага:
${job.requirements.join(", ")}

---

Зөвхөн цэвэр, parse хийхэд бэлэн JSON хариу буцаана уу. Бусад тайлбар, текст, markdown, код блок битгий бичээрэй.
`;

      const aiContent = await getGeminiResponse(prompt);

      if (!aiContent) {
        console.error("Gemini AI response хоосон байна.");
        continue;
      }

      const result = extractAiSummary(aiContent);
      aiResults.push(result);
    }

    const uniqueSkills = Array.from(
      new Set(aiResults.flatMap((r) => r.matchedSkills))
    );
    const finalResult = {
      matchPercentage: Math.max(...aiResults.map((r) => r.matchPercentage)),
      matchedSkills: uniqueSkills,
      summary: aiResults
        .map((r) => r.summary)
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .join(" "),
      firstName: aiResults[0]?.firstName || "",
      lastName: aiResults[0]?.lastName || "",
    };

    const status =
      finalResult.matchPercentage >= 80 ? "shortlisted" : "pending";

    const application = await ApplicationModel.create({
      jobId,
      cvUrl,
      extractedText: cvText,
      matchPercentage: finalResult.matchPercentage,
      matchedSkills: finalResult.matchedSkills,
      bookmarked: false,
      aiSummary: {
        firstName: finalResult.firstName,
        lastName: finalResult.lastName,
        skills: finalResult.matchedSkills,
        summary: finalResult.summary,
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

export async function GET() {
  try {
    await connectMongoDb();

    const applications = await ApplicationModel.find({})
      .populate("jobId", "title company description requirements")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({
      success: true,
      data: applications,
    });
  } catch (error) {
    console.error("Applications fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch applications",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
export const DELETE = async (req: NextRequest) => {
  try {
    await connectMongoDb();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required" },
        { status: 400 }
      );
    }

    const application = await ApplicationModel.findByIdAndDelete(id);

    if (!application) {
      return NextResponse.json(
        { success: false, message: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    console.error("Delete application error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
};
