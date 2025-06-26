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

// Текстийг хуваах функц
const chunkText = (text: string, maxLength: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
};

export const POST = async (req: NextRequest) => {
  try {
    await connectMongoDb();

    const formData = await req.formData();
    const cvUrl = formData.get("cvUrl") as string;
    const jobId = formData.get("jobId") as string;
    let cvText = formData.get("cvText") as string;

    console.log("CV TEXT", cvText);

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

    // CV текстийг хуваах
    const chunks = chunkText(cvText, 50000);
    let aiResults: any[] = [];

    for (const chunk of chunks) {
      const prompt = `
CV текст болон ажлын шаардлагыг уншаад, хэрхэн нийцэж байгааг шинжил. Дараах зааврыг дага:

1. **Хэлний онцлог**: CV текст нь монгол (кирилл) болон англи хэлний холимог байна. Монгол хэлний нэр (жишээ нь, "Тодхүү", "Төгөлдөр") болон техникийн нэр томьёог (жишээ нь, "JavaScript", "Next.js") зөв тань.
2. **Туршлага ба төсөл**: CV-д дурдагдсан туршлагын хугацаа (жишээ нь, "1+ жил"), төслүүд (жишээ нь, "Vibe Store", "Tinder Clone"), онцлох шийдлүүд (жишээ нь, "бодит цагийн чат", "QPay төлбөрийн систем")-ийг тодорхой илрүүл.
3. **Ур чадварын харьцуулалт**: Ажлын шаардлага болон CV-ийн ур чадваруудыг (жишээ нь, "ReactJS ахисан түвшний мэдлэг", "NextJS App Router туршлага") нарийвчлан харьцуулж, нийцсэн ур чадваруудыг жагсаа.
4. **Товч тайлбар**: Хариуг товч, тодорхой зөв бич. CV-ийн гол давуу тал, ажлын шаардлагад хэрхэн нийцэж буйг өөрийнхөөрөө онцол.
5. **JSON формат**: Хариуг дараах JSON хэлбэрээр гарга өөр юм бичихгүй:
{
  "matchPercentage": [0-100],
  "matchedSkills": ["ур чадвар1", "ур чадвар2", ...],
  "summary": "Товч тайлбар: CV-ийн гол давуу тал ба ажлын шаардлагад хэрхэн нийцсэн тухай..."
}

CV текст:
${chunk}

Ажлын шаардлага:
${job.requirements.join(", ")}
`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      });

      const aiContent = aiResponse.choices[0].message?.content ?? "";
      aiResults.push(extractAiSummary(aiContent));
    }

    // AI-ийн үр дүнг нэгтгэх
    const finalResult = {
      matchPercentage: Math.max(...aiResults.map((r) => r.matchPercentage)),
      matchedSkills: Array.from(
        new Set(aiResults.flatMap((r) => r.matchedSkills))
      ),
      summary: aiResults.map((r) => r.summary).join(" "),
    };

    const status =
      finalResult.matchPercentage >= 70 ? "shortlisted" : "pending";

    const application = await ApplicationModel.create({
      jobId,
      cvUrl,
      extractedText: cvText,
      matchPercentage: finalResult.matchPercentage,
      matchedSkills: finalResult.matchedSkills,
      bookmarked: false,
      aiSummary: {
        mainSentence: finalResult.summary,
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

export const GET = async () => {
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
