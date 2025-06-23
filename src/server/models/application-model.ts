import mongoose, { Schema } from "mongoose";

const ApplicationSchema = new mongoose.Schema({
  jobId: { type: Schema.Types.ObjectId, ref: "Jobs", required: true },
  cvUrl: { type: String, required: true },
  extractedText: { type: String, required: true },
  matchPercentage: { type: Number, required: true },
  matchedSkills: { type: [String], required: true },
  bookmarked: { type: Boolean, default: false },
  aiSummary: {
    mainSentence: String,
    skills: [String],
    summary: String,
  },
  status: {
    type: String,
    enum: ["shortlisted", "pending"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);
