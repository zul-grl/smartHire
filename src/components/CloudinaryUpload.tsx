"use client";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, FileText, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  handleFile: (_file: File) => void;
};

const FileUpload = ({ handleFile }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFile(selectedFile);
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type === "application/pdf") {
      handleFile(files[0]);
      setFile(files[0]);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 mr-3">
          2
        </span>
        CV байршуулах
      </h2>

      <div
        onClick={() => !file && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {file ? (
          <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF файл
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <Button
                    onClick={handleRemoveFile}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className={`cursor-pointer transition-all hover:shadow-lg ${isDragging ? "ring-2 ring-blue-600 bg-blue-50" : ""
            }`}>
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? "bg-blue-100" : "bg-gray-100"
                  }`}>
                  <Upload className={`h-10 w-10 transition-colors ${isDragging ? "text-blue-600" : "text-gray-400"
                    }`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  PDF файл чирж оруулах
                </h3>
                <p className="text-gray-600 mb-4">
                  эсвэл <span className="text-blue-600 font-medium">файл сонгох</span>
                </p>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FileText className="h-4 w-4" />
                  <span>Зөвхөн PDF файл • 10MB хүртэл</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Input
          ref={fileInputRef}
          onChange={handleOnChange}
          type="file"
          accept=".pdf"
          className="hidden"
        />
      </div>
    </div>
  );
};

export default FileUpload;
