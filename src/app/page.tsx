"use client";

import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
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
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Building2, FileText, Loader2 } from "lucide-react";
import axios from "axios";
import CloudinaryUpload from "@/components/CloudinaryUpload";
import { Job } from "@/server/types";

// Текстийг цэвэрлэх функц
const cleanText = (text: string): string => {
  return text
    .replace(/[^\w\s.,!?@а-яА-ЯөүӨҮ]/g, "")
    .replace(/\s+/g, " ") // Давхардсан зай арилгах
    .replace(/(\w)\s+\.\s+(\w)/g, "$1.$2") // "Ne x t. j s" → "Next.js"
    .trim();
};

// Текстийг эмх замбараагүй эсэхийг шалгах
const isTextGarbled = (text: string): boolean => {
  const garbledPattern = /[^\w\s.,!?@а-яА-ЯөүӨҮ]/g;
  const garbledCount = (text.match(garbledPattern) || []).length;
  return garbledCount / text.length > 0.3 || text.length < 50;
};

// PDF-ээс зураг гаргах функц (браузерын canvas ашиглана)
const pdfToImages = async (pdfUrl: string): Promise<string[]> => {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

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
      const viewport = page.getViewport({ scale: 1.0 });

      // Браузерын canvas элемент үүсгэх
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
    console.error("PDF-ээс зураг гаргахад алдаа:", error);
    throw error;
  }
};

// PDF-ээс текст гаргах функц (pdf.js)
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
        .map((item: any) => item.str || "")
        .filter((text: string) => text.trim().length > 0)
        .join(" ");
      texts.push(pageText);
    }

    const fullText = cleanText(texts.join("\n\n"));
    if (!fullText) {
      throw new Error("PDF-ээс текст олдсонгүй.");
    }
    console.log("Extracted text (pdf.js):", fullText.substring(0, 500));
    return fullText;
  } catch (error) {
    console.error("PDF.js текст гаргахад алдаа:", error);
    throw error;
  }
};

// OCR ашиглан текст гаргах функц (Tesseract.js)
const extractTextWithOCR = async (pdfUrl: string): Promise<string> => {
  try {
    const imageUrls = await pdfToImages(pdfUrl);
    const texts: string[] = [];

    for (const imageUrl of imageUrls) {
      const result = await Tesseract.recognize(imageUrl, "eng+mon", {
        logger: (m) => console.log(m),
      });
      texts.push(cleanText(result.data.text));
    }

    const fullText = texts.join("\n\n");
    if (!fullText) {
      throw new Error("OCR-ээс текст олдсонгүй.");
    }
    console.log("Extracted text (OCR):", fullText.substring(0, 500));
    return fullText;
  } catch (error) {
    console.error("OCR алдаа:", error);
    throw new Error(
      `OCR ашиглан текст гаргаж чадсангүй: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// Нэгтгэсэн текст гаргах функц
const extractText = async (pdfUrl: string): Promise<string> => {
  try {
    const text = await extractTextFromPDF(pdfUrl);
    if (isTextGarbled(text)) {
      console.log("pdf.js текст эмх замбараагүй, OCR-г оролдож байна...");
      return await extractTextWithOCR(pdfUrl);
    }
    return text;
  } catch (error) {
    console.log("pdf.js амжилтгүй, OCR-г оролдож байна...");
    return await extractTextWithOCR(pdfUrl);
  }
};

export default function Home() {
  const [selectedJob, setSelectedJob] = useState("");
  const [availableJobs, setAvailableJobs] = useState<Job[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get("/api/jobs");
        setAvailableJobs(data.data);
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
        setErrorMessage("Ажлын байрны мэдээлэл татаж чадсангүй.");
      }
    };
    fetchData();
  }, []);

  const handleFile = (file: File) => {
    setFile(file);
    setExtractedText("");
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
      console.error("Cloudinary upload error:", err);
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

      setIsExtracting(true);
      const extractedText = await extractText(uploadedUrl);
      setExtractedText(extractedText);
      setIsExtracting(false);

      const formData = new FormData();
      formData.append("cvUrl", uploadedUrl);
      formData.append("jobId", selectedJob);
      formData.append("cvText", extractedText);

      const res = await axios.post("/api/applications", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        alert("Өргөдөл амжилттай илгээгдлээ!");
        setSelectedJob("");
        setFile(null);
        setExtractedText("");
      } else {
        setErrorMessage(
          "Алдаа гарлаа: " + (res.data.message || "Дахин оролдоно уу.")
        );
      }
    } catch (err) {
      console.error("Application submission error:", err);
      setErrorMessage(
        `Өргөдөл илгээхэд алдаа гарлаа: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      setIsExtracting(false);
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
            <Building2 className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Ажилд орох
              </h1>
              <p className="text-sm text-gray-600">Өргөдөл гаргах хуудас</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {errorMessage}
          </div>
        )}
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

          {extractedText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Гаргаж авсан текст
                </CardTitle>
                <CardDescription>
                  PDF файлаас гаргаж авсан текст ({extractedText.length}{" "}
                  тэмдэгт)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-md text-sm">
                  {extractedText.substring(0, 500)}
                  {extractedText.length > 500 && "..."}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-end mt-4">
            <Button
              type="submit"
              size="lg"
              disabled={!selectedJob || !file || isSubmitting || isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Текст гаргаж байна...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Илгээж байна...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
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
