import { connectMongoDb } from "@/server/lib/mongodb";
import { JobModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
  await connectMongoDb();

  try {
    const { title, description, requirements } = await req.json();

    if (
      !title ||
      !description ||
      !requirements ||
      !Array.isArray(requirements)
    ) {
      return NextResponse.json(
        { success: false, message: "Бүх талбарыг зөв бөглөнө үү." },
        { status: 400 }
      );
    }

    const job = await JobModel.create({
      title,
      description,
      requirements,
    });

    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (error) {
    console.error("Job үүсгэхэд алдаа гарлаа:", error);
    return NextResponse.json(
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};

export const GET = async () => {
  await connectMongoDb();

  try {
    const jobs = await JobModel.find().sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.error("Ажлын зарууд авахад алдаа гарлаа:", error);
    return NextResponse.json(
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};
