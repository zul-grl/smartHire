import { connectMongoDb } from "@/server/lib/mongodb";
import { ApplicationModel } from "@/server/models";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  await connectMongoDb();

  try {
    const { id, status, bookmarked } = await req.json();
    console.log("PATCH request for application ID:", id);
    console.log("Request body:", { status, bookmarked });

    // Validate ID
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing or invalid application ID" },
        { status: 400 }
      );
    }

    // Validate status
    if (status && !["pending", "shortlisted"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status value" },
        { status: 400 }
      );
    }

    // Validate bookmarked
    if (bookmarked !== undefined && typeof bookmarked !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Invalid bookmark value" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: {
      status?: "pending" | "shortlisted";
      bookmarked?: boolean;
    } = {};

    if (status !== undefined) updateData.status = status;
    if (bookmarked !== undefined) updateData.bookmarked = bookmarked;

    // Update application
    const application = await ApplicationModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("jobId");

    if (!application) {
      console.log("Application not found for ID:", id);
      return NextResponse.json(
        { success: false, message: "Application not found" },
        { status: 404 }
      );
    }

    console.log("Updated application:", application);
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
}
