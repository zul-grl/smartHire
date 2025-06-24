import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  await connectMongoDb();

  try {
    const { id } = params;

    const application = await ApplicationModel.findById(id);
    if (!application) {
      return NextResponse.json(
        { success: false, message: "CV олдсонгүй." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    console.error("Get by ID error:", error);
    return NextResponse.json(
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};
