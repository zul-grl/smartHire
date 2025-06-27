import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractAiSummary(content: string) {
  try {
    console.log("Raw AI content:", content.substring(0, 500));
    const parsed = JSON.parse(content);
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
    console.log("Parsed AI summary:", parsed); // Parsed утгыг лог хийх
    return parsed;
  } catch (error) {
    console.error("JSON parse алдаа:", error);
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

    if (!cvUrl || !jobId || !cvText) {
      return NextResponse.json(
        { success: false, message: "CV URL, CV текст, jobId шаардлагатай." },
        { status: 400 }
      );
    }

    // cvText-ийн кодчиллыг шалгах
    console.log("Received cvText:", cvText.substring(0, 500));

    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    // CV текстийг хуваах
    const chunks = chunkText(cvText, 20000);
    let aiResults: any[] = [];

    for (const chunk of chunks) {
      const prompt = `
CV текст болон ажлын шаардлагыг уншаад, хэрхэн нийцэж байгааг шинжил. Дараах зааврыг тодорхой дага:

1. **Хэлний онцлог**: 
   - CV текст нь монгол (кирилл) болон англи хэлний холимог байна. Монгол хэлний нэр (жишээ нь, "Тодхүү", "Төгөлдөр", "Бат-Эрдэнэ") болон тусгай үсэг ("ү", "ө")-ийг зөв таньж, дүрмийн алдаа гаргахгүйгээр боловсруул (жишээ нь, "ур чадвартай", "туршлагатай" гэдгийг зөв бич).
   - Техникийн нэр томьёог (жишээ нь, "JavaScript", "Next.js", "GraphQL") яг хэвээр хадгал.
2. **Нэр, овог ялгах**:
   - CV-ээс ирүүлэгчийн нэр (жишээ нь, "Тодхүү", "Төгөлдөр") болон овог (жишээ нь, "Зоригтбаатар", "Бат")-ыг тодорхой ялгаж, JSON хариунд "firstName" болон "lastName" талбаруудад оруул.
   - Хэрвээ нэр, овог тодорхойгүй бол "firstName": "", "lastName": "" гэж буцаа.
3. **Туршлага ба төсөл**: 
   - CV-д дурдагдсан туршлагын хугацаа (жишээ нь, "1+ жил", "8 сар"), төслүүд (жишээ нь, "Vibe Store", "Tinder Clone"), онцлох шийдлүүд (жишээ нь, "бодит цагийн чат", "QPay төлбөрийн систем")-ийг тодорхой илрүүлж, summary-д оруул.
4. **Ур чадварын харьцуулалт**: 
   - Ажлын шаардлага болон CV-ийн ур чадваруудыг (жишээ нь, "ReactJS ахисан түвшний мэдлэг", "NextJS App Router туршлага") нарийвчлан харьцуулж, нийцсэн ур чадваруудыг жагсаа.
   - Туршлагын хугацааг (жишээ нь, "1+ жил туршлага") ур чадвар болгон оруул.
5. **Товч тайлбар**: 
   - Summary-г товч, тодорхой бич. CV-ийн гол давуу тал (туршлага, төсөл, ур чадвар), ажлын шаардлагад хэрхэн нийцэж буйг онцол.
   - Монгол хэлний дүрмийг зөв ашигла (жишээ нь, "туршлагатай", "ур чадвартай").
6. **JSON формат**: 
   - Хариуг зөв JSON хэлбэрээр гарга. matchPercentage нь 0-100 хооронд, matchedSkills нь массив, summary нь товч текст, firstName болон lastName нь нэр, овог байна:
{
  "matchPercentage": [0-100],
  "matchedSkills": ["ур чадвар1", "ур чадвар2", ...],
  "summary": "Товч тайлбар: CV-ийн гол давуу тал ба ажлын шаардлагад хэрхэн нийцсэн тухай...",
  "firstName": "Нэр",
  "lastName": "Овог"
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
      console.log("AI response:", aiContent);
      const result = extractAiSummary(aiContent);
      console.log("ai result", result);
      aiResults.push(result);
    }

    // AI-ийн үр дүнг нэгтгэх (давхардлыг арилгах)
    const uniqueSkills = Array.from(
      new Set(aiResults.flatMap((r) => r.matchedSkills))
    );
    const finalResult = {
      matchPercentage: Math.max(...aiResults.map((r) => r.matchPercentage)),
      matchedSkills: uniqueSkills,
      summary: aiResults
        .map((r) => r.summary)
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .join(" "), // Давхардсан summary-г арилгах
      firstName: aiResults[0]?.firstName || "", // Эхний chunk-аас нэр авна
      lastName: aiResults[0]?.lastName || "",
    };

    console.log("Final AI result before saving:", finalResult); // Хадгалахын өмнө finalResult-ыг лог хийх

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
        firstName: finalResult.firstName,
        lastName: finalResult.lastName,
        skills: finalResult.matchedSkills,
        summary: finalResult.summary,
      },
      status,
    });

    console.log("Saved application:", application); // Хадгалсан бичлэгийг лог хийх

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
