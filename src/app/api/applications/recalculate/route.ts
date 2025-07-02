import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel } from "@/server/models";
import { NextResponse } from "next/server";
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

export async function POST() {
  try {
    await connectMongoDb();

    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message:
            "GEMINI_API_KEY is not configured. Please add it to your .env file.",
          updated: 0,
        },
        { status: 500 }
      );
    }

    // Get all applications without matchPercentage or with 0
    const applications = await ApplicationModel.find({
      $or: [
        { matchPercentage: { $exists: false } },
        { matchPercentage: null },
        { matchPercentage: 0 },
      ],
    }).populate("jobId");

    let updatedCount = 0;
    const errors: { applicationId: string; error: string }[] = [];

    for (const application of applications) {
      try {
        if (!application.jobId || !application.extractedText) {
          continue;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const job = application.jobId as any;
        const chunks = chunkText(application.extractedText, 20000);
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

        if (aiResults.length === 0) {
          continue;
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
          finalResult.matchPercentage >= 70 ? "shortlisted" : "pending";

        // Update the application
        await ApplicationModel.findByIdAndUpdate(application._id, {
          matchPercentage: finalResult.matchPercentage,
          matchedSkills: finalResult.matchedSkills,
          status,
          aiSummary: {
            firstName: finalResult.firstName,
            lastName: finalResult.lastName,
            skills: finalResult.matchedSkills,
            summary: finalResult.summary,
          },
        });

        updatedCount++;
      } catch (error) {
        console.error(`Error updating application ${application._id}:`, error);
        errors.push({
          applicationId: application._id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recalculated ${updatedCount} applications`,
      total: applications.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Recalculation error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}
