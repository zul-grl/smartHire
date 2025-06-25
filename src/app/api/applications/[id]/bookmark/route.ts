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
    console.log("PATCH request for application ID:", id); // Debug
    const { status, bookmarked } = await req.json();
    console.log("Request body:", { status, bookmarked }); // Debug

    if (status && !["pending", "shortlisted"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status value" },
        { status: 400 }
      );
    }

    if (bookmarked !== undefined && typeof bookmarked !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Invalid bookmark value" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (status !== undefined) updateData.status = status;
    if (bookmarked !== undefined) updateData.bookmarked = bookmarked;

    const application = await ApplicationModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("jobId");

    if (!application) {
      console.log("Application not found for ID:", id); // Debug
      return NextResponse.json(
        { success: false, message: "Application not found" },
        { status: 404 }
      );
    }

    console.log("Updated application:", application); // Debug
    return NextResponse.json({
      success: true,
      data: application,
      message: "Update successful",
    });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
};
