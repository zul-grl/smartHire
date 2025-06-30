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
export async function PUT(req: NextRequest) {
  try {
    await connectMongoDb();
    const { id, title, description, requirements } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required" },
        { status: 400 }
      );
    }

    const updatedJob = await JobModel.findByIdAndUpdate(
      id,
      { title, description, requirements },
      { new: true }
    );

    if (!updatedJob) {
      return NextResponse.json(
        { success: false, message: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedJob,
      message: "Job updated successfully",
    });
  } catch (error) {
    console.error("Job update error:", error);
    return NextResponse.json(
      { success: false, message: "Error updating job" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectMongoDb();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required" },
        { status: 400 }
      );
    }

    const deletedJob = await JobModel.findByIdAndDelete(id);

    if (!deletedJob) {
      return NextResponse.json(
        { success: false, message: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Job deletion error:", error);
    return NextResponse.json(
      { success: false, message: "Error deleting job" },
      { status: 500 }
    );
  }
}
