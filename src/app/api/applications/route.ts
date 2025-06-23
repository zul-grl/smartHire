import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel, JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import cloudinary from "@/server/lib/cloudinary";
import axios from "axios";

export const GET = async (req: NextRequest) => {
  await connectMongoDb();

  try {
    const { searchParams } = new URL(req.url);

    // Query parameters авах
    const skillsQuery = searchParams.get("skills"); // жишээ: 'React,Node'
    const minMatch = searchParams.get("minMatch"); // жишээ: '80'

    const filters: any = {};

    // Ур чадвар шүүлт
    if (skillsQuery) {
      const skillsArray = skillsQuery.split(",").map((skill) => skill.trim());
      filters.matchedSkills = { $in: skillsArray };
    }

    // Match хувь шүүлт
    if (minMatch) {
      filters.matchPercentage = { $gte: Number(minMatch) };
    }

    // Application-уудыг шүүж авах
    const applications = await ApplicationModel.find(filters).sort({
      createdAt: -1,
    });

    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    console.error("Filter error:", error);
    return NextResponse.json(
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const POST = async (req: NextRequest) => {
  await connectMongoDb();

  try {
    const formData = await req.formData();
    const file = formData.get("cv") as File;
    const jobId = formData.get("jobId") as string;

    if (!file || !jobId) {
      return NextResponse.json(
        { success: false, message: "File болон jobId шаардлагатай." },
        { status: 400 }
      );
    }

    // 👉 Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadRes = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "raw", folder: "smartshortlist" },
          (error, result) => {
            if (error) reject(error);
            resolve(result);
          }
        )
        .end(buffer);
    });

    const cvUrl = uploadRes.secure_url;

    // 👉 PDF to Text from Cloudinary URL
    const response = await axios.get(cvUrl, { responseType: "arraybuffer" });
    const parsedPdf = await pdfParse(response.data);
    const text = parsedPdf.text;

    // 👉 Job requirements авах
    const job = await JobModel.findById(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, message: "Ажлын зар олдсонгүй." },
        { status: 404 }
      );
    }

    // 👉 Keyword Match тооцох
    const matchedSkills = job.requirements.filter((requirement) =>
      text.toLowerCase().includes(requirement.toLowerCase())
    );

    const matchPercentage = Math.round(
      (matchedSkills.length / job.requirements.length) * 100
    );

    // 👉 GPT AI Prompt
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
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o",
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
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};

function extractAiSummary(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {
      mainSentence: "AI тайлбар уншигдсангүй.",
      skills: [],
      summary: content,
    };
  }
}
