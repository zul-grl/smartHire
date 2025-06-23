import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async (
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

    // Bookmark статусыг эсрэг болгож солих
    application.bookmarked = !application.bookmarked;
    await application.save();

    return NextResponse.json({
      success: true,
      data: application,
      message: "Bookmark статус амжилттай солигдлоо.",
    });
  } catch (error) {
    console.error("Bookmark error:", error);
    return NextResponse.json(
      { success: false, message: "Серверийн алдаа." },
      { status: 500 }
    );
  }
};
