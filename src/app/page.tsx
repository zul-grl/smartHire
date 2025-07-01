"use client";

import { useEffect, useState } from "react";
import Tesseract from "tesseract.js";
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
import { Building2, Loader2, Briefcase, FileText, Send } from "lucide-react";
import axios from "axios";
import CloudinaryUpload from "@/components/CloudinaryUpload";
import { Job } from "@/server/types";
import { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlobalWorkerOptions } from "pdfjs-dist";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

const cleanText = (text: string): string => {
  return text
    .replace(/[^\w\s.,!?@а-яА-ЯөүӨҮ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/(\w)\s+\.\s+(\w)/g, "$1.$2")
    .trim();
};
const isTextGarbled = (text: string): boolean => {
  const garbledPattern = /[^\w\s.,!?@а-яА-ЯөүӨҮ]/g;
  const garbledCount = (text.match(garbledPattern) || []).length;
  return garbledCount / text.length > 0.3 || text.length < 50;
};

const pdfToImages = async (pdfUrl: string): Promise<string[]> => {
  try {
    GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/",
      cMapPacked: true,
      withCredentials: false,
    }).promise;

    const totalPageCount = pdf.numPages;
    const imageUrls: string[] = [];

    for (let currentPage = 1; currentPage <= totalPageCount; currentPage++) {
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas контекст үүсгэж чадсангүй.");
      }

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageDataUrl = canvas.toDataURL("image/png");
      imageUrls.push(imageDataUrl);
    }

    return imageUrls;
  } catch (error) {
    throw error;
  }
};

const extractTextFromPDF = async (pdfUrl: string): Promise<string> => {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

    const pdf = await pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/",
      cMapPacked: true,
      withCredentials: false,
    }).promise;

    const totalPageCount = pdf.numPages;
    const texts: string[] = [];

    for (let currentPage = 1; currentPage <= totalPageCount; currentPage++) {
      const page = await pdf.getPage(currentPage);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: TextItem | TextMarkedContent) => {
          if ("str" in item) {
            return item.str || "";
          }
          return "";
        })
        .filter((text: string) => text.trim().length > 0)
        .join(" ");
      texts.push(pageText);
    }

    const fullText = cleanText(texts.join("\n\n"));
    if (!fullText) {
      // throw new Error("PDF-ээс текст олдсонгүй.");
    }
    return fullText;
  } catch (error) {
    throw error;
  }
};

const extractTextWithOCR = async (pdfUrl: string): Promise<string> => {
  try {
    const imageUrls = await pdfToImages(pdfUrl);
    const texts: string[] = [];

    for (const imageUrl of imageUrls) {
      const result = await Tesseract.recognize(imageUrl, "eng+mon");
      texts.push(cleanText(result.data.text));
    }

    const fullText = texts.join("\n\n");
    if (!fullText) {
      throw new Error("OCR-ээс текст олдсонгүй.");
    }
    return fullText;
  } catch (error) {
    throw new Error(
      `OCR ашиглан текст гаргаж чадсангүй: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

const extractText = async (pdfUrl: string): Promise<string> => {
  try {
    const text = await extractTextFromPDF(pdfUrl);
    if (isTextGarbled(text)) {
      return await extractTextWithOCR(pdfUrl);
    }
    return text;
  } catch {
    return await extractTextWithOCR(pdfUrl);
  }
};

export default function Home() {
  const [selectedJob, setSelectedJob] = useState("");
  const [availableJobs, setAvailableJobs] = useState<Job[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get("/api/jobs");
        setAvailableJobs(data.data);
      } catch {
        setErrorMessage("Ажлын байрны мэдээлэл татаж чадсангүй.");
      }
    };
    fetchData();
  }, []);

  const handleFile = (file: File) => {
    setFile(file);
    setErrorMessage("");
  };

  const handleUpload = async () => {
    const PRESET_NAME = "food-delivery-app";
    const CLOUDINARY_NAME = "ds6kxgjh0";
    if (!file) {
      setErrorMessage("Файл сонгоно уу.");
      return null;
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
        throw new Error(data.error?.message || "Файл хуулахад алдаа гарлаа.");
      }
      return data.secure_url;
    } catch (err) {
      setErrorMessage(
        `Файлыг хуулахад алдаа гарлаа: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedJob) {
      setErrorMessage("Файл болон ажлын байр сонгоно уу.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const uploadedUrl = await handleUpload();
      if (!uploadedUrl) {
        setErrorMessage("Файлыг амжилттай байршуулж чадсангүй.");
        return;
      }

      const extractedText = await extractText(uploadedUrl);

      const formData = new FormData();
      formData.append("cvUrl", uploadedUrl);
      formData.append("jobId", selectedJob);
      formData.append("cvText", extractedText);

      const res = await axios.post("/api/applications", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        toast("Өргөдөл амжилттай илгээгдлээ!");
        router.push("/admin");
        setSelectedJob("");
        setFile(null);
      } else {
        setErrorMessage(
          "Алдаа гарлаа: " + (res.data.message || "Дахин оролдоно уу.")
        );
      }
    } catch (err) {
      setErrorMessage(
        `Өргөдөл илгээхэд алдаа гарлаа: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedJobDetails = availableJobs?.find(
    (job) => job._id === selectedJob
  );

  return (
    <div className="min-h-screen animate-fade-in-up">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SmartHire
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start">
            <svg
              className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="mb-12 animate-fade-in-up">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4 sm:space-x-8">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedJob
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <Briefcase className="h-6 w-6" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-600">
                  Ажил сонгох
                </p>
              </div>
              <div
                className={`h-1 w-12 sm:w-24 transition-colors duration-300 ${
                  file ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    file
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <FileText className="h-6 w-6" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-600">
                  CV байршуулах
                </p>
              </div>
              <div className="h-1 w-12 sm:w-24 bg-gray-200" />
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center">
                  <Send className="h-6 w-6" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-600">Илгээх</p>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up">
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
                <div className="mt-2 p-4 bg-blue-10 rounded-lg">
                  <h3 className="font-semibold">{selectedJobDetails.title}</h3>
                  <div className="grid grid-cols-1">
                    {selectedJobDetails.requirements.map((req, index) => (
                      <p key={index} className="mt-3 text-[14px]">
                        {" "}
                        - {req}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <CloudinaryUpload handleFile={handleFile} />
          <div className="flex justify-end mt-4">
            <Button
              type="submit"
              size="lg"
              disabled={!selectedJob || !file || isSubmitting}
              className="min-w-[200px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Илгээж байна...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Өргөдөл илгээх
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
