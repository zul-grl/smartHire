"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Building2 } from "lucide-react";
import { Job } from "@/server/types";
import axios from "axios";
import CloudinaryUpload from "@/components/CloudinaryUpload";
declare global {
  interface Window {
    extractText: (pdfUrl: string) => Promise<string>;
  }
}

export default function Home() {
  const [selectedJob, setSelectedJob] = useState("");
  const [availableJobs, setAvailableJobs] = useState<Job[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get("/api/jobs");
        setAvailableJobs(data.data);
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
        alert("Ажлын байрны мэдээлэл татаж чадсангүй.");
      }
    };
    fetchData();
  }, []);

  const handleFile = (file: File) => {
    setFile(file);
    console.log("Selected file:", file.name, "Size:", file.size);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedJob) {
      alert("Файл болон ажлын байр сонгоно уу.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedUrl = await handleUpload();
      if (!uploadedUrl) {
        alert("Файлыг амжилттай байршуулж чадсангүй.");
        return;
      }
      console.log("Uploaded URL:", uploadedUrl);

      const extractedText = await window.extractText(uploadedUrl as string);
      console.log("Extracted Text:", extractedText);

      const formData = new FormData();
      formData.append("cvUrl", uploadedUrl);
      formData.append("jobId", selectedJob);
      formData.append("cvText", extractedText);

      const res = await axios.post("/api/applications", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        alert(
          "Өргөдөл амжилттай илгээгдлээ! Бид тантай удахгүй холбогдох болно."
        );
        setSelectedJob("");
        setFile(null);
      } else {
        alert("Алдаа гарлаа: " + (res.data.message || "Дахин оролдоно уу."));
      }
    } catch (err) {
      console.error("POST илгээхэд алдаа гарлаа:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async () => {
    const PRESET_NAME = "food-delivery-app";
    const CLOUDINARY_NAME = "ds6kxgjh0";
    if (!file) {
      alert("please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", PRESET_NAME);
    formData.append("api_key", CLOUDINARY_NAME);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/raw/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        console.error("Cloudinary upload failed:", data);
        throw new Error(data.error?.message || "Файл хуулахад алдаа гарлаа.");
      }
      console.log("Cloudinary Response:", data);
      return data.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      alert(
        "Файлыг хуулахад алдаа гарлаа: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
      return null;
    }
  };

  const selectedJobDetails = availableJobs?.find(
    (job) => job._id === selectedJob
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Ажилд орох
                </h1>
                <p className="text-sm text-gray-600">Өргөдөл гаргах хуудас</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Ажлын байр сонгох</CardTitle>
              <CardDescription>
                Та аль ажлын байранд өргөдөл гаргахыг хүсэж байна?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Ажлын байр сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {availableJobs?.map((job: Job) => (
                    <SelectItem key={job._id} value={job._id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedJobDetails && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900">
                    {selectedJobDetails.title}
                  </h3>
                  <p className="text-sm text-blue-700 mb-2"></p>
                  <div className="flex flex-wrap gap-2">
                    {selectedJobDetails.requirements.map((req, index) => (
                      <Badge key={index} variant="secondary">
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <CloudinaryUpload handleFile={handleFile} />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={!selectedJob || !file || isSubmitting}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {isSubmitting ? "Илгээж байна..." : "Өргөдөл илгээх"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
