import mongoose, { model, Model, models, Schema } from "mongoose";
import { Job } from "../types";

const JobSchema: Schema = new Schema<Job>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: [String], required: true },
  },
  { timestamps: true }
);

export const JobModel: Model<Job> =
  models["Job"] || model<Job>("Job", JobSchema);
