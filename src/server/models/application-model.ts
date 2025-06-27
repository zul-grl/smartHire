import mongoose, { model, Model, models, Schema } from "mongoose";
import { Application } from "../types";

const ApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    cvUrl: { type: String, required: true },
    extractedText: { type: String, required: true },
    matchPercentage: { type: Number, required: true },
    matchedSkills: { type: [String], required: true },
    bookmarked: { type: Boolean, default: false },
    aiSummary: {
      firstName: { type: String },
      lastName: { type: String },
      skills: { type: [String] },
      summary: { type: String },
    },
    status: {
      type: String,
      enum: ["shortlisted", "pending"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const ApplicationModel: Model<Application> =
  models["Application"] || model<Application>("Application", ApplicationSchema);
