"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Upload, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  handleFile: (_file: File) => void;
};

const FileUpload = ({ handleFile }: Props) => {
  const [file, setFile] = useState<File | null>(null);

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFile(selectedFile);
      setFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  return (
    <>
      <label htmlFor="file-input">
        {file ? (
          <Card className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button onClick={handleRemoveFile} type="button">
              <Trash2 className="text-red-500 w-5 h-5" />
            </button>
          </Card>
        ) : (
          <Card className="p-6 cursor-pointer">
            <CardHeader>
              <CardTitle>CV байршуулах</CardTitle>
            </CardHeader>
            <CardContent className="h-[138px] border-2 border-dashed border-gray-300 rounded-lg flex flex-col justify-center items-center p-6 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">
                PDF файл сонгох
              </p>
              <p className="text-sm text-gray-600">Эсвэл энд чирж оруулах</p>
            </CardContent>
          </Card>
        )}
        <Input
          id="file-input"
          onChange={handleOnChange}
          type="file"
          accept=".pdf"
          className="hidden"
        />
      </label>
    </>
  );
};

export default FileUpload;
