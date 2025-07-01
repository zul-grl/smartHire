"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  BookmarkCheck,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  TrendingUp,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Briefcase, Users, Edit, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Application {
  _id: string;
  jobId: {
    _id: string;
    title: string;
    company: string;
  };
  cvUrl: string;
  extractedText: string;
  matchPercentage: number;
  matchedSkills: string[];
  bookmarked: boolean;
  aiSummary: {
    firstName: string;
    lastName: string;
    skills: string[];
    summary: string;
  };
  status: "shortlisted" | "pending";
  createdAt: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getMatchColor = (percentage: number) => {
  if (percentage >= 80) return "bg-green-100 text-green-800";
  if (percentage >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const getStatusColor = (status: string) => {
  if (status === "shortlisted") return "bg-green-100 text-green-800";
  return "bg-yellow-100 text-yellow-800";
};

interface Job {
  _id: string;
  title: string;
  description: string;
  requirements: string[];
  createdAt: string;
}

export default function ApplicationPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "shortlisted" | "pending"
  >("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<
    "newest" | "oldest" | "matchHigh" | "matchLow"
  >("newest");
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCvUrl, setSelectedCvUrl] = useState<string | null>(null);
  const [isCvModalOpen, setIsCvModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("applications");
  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    requirements: [""],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const handleViewCv = (cvUrl: string) => {
    setSelectedCvUrl(cvUrl);
    setIsCvModalOpen(true);
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) {
        throw new Error("Failed to fetch jobs");
      }
      const data = await res.json();
      setJobs(data.data || []);
    } catch {
      toast.error("Ажлын байр ачаалахад алдаа гарлаа");
    }
  };

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Аппликейшн татахад алдаа гарлаа");
      }
      const data = await res.json();
      console.log("Аппликейшн татагдсан:", data.data);
      setApplications(data.data || []);
    } catch (error) {
      console.error("Fetch алдаа:", error);
      toast.error("Аппликейшн ачаалахад алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBookmark = async (id: string) => {
    setUpdatingId(id);
    try {
      const application = applications.find((app) => app._id === id);
      if (!application) {
        throw new Error("Аппликейшн олдсонгүй");
      }

      const newBookmarkStatus = !application.bookmarked;
      console.log("Toggling bookmark for ID:", id, "to:", newBookmarkStatus);

      const res = await fetch(`/api/applications/bookmark`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, bookmarked: newBookmarkStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.message || "Bookmark шинэчлэхэд алдаа гарлаа"
        );
      }

      const data = await res.json();
      setApplications((prev) =>
        prev.map((app) => (app._id === id ? data.data : app))
      );

      toast.success(
        data.data.bookmarked ? "Bookmark хийгдлээ" : "Bookmark цуцлагдлаа"
      );
    } catch (error) {
      console.error("Bookmark алдаа:", error);
      toast.error(
        error instanceof Error ? error.message : "Bookmark солиход алдаа гарлаа"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "newest" ? "oldest" : "newest");
  };

  const filteredApplications = applications
    .filter((app) => {
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (bookmarkedOnly && !app.bookmarked) return false;
      if (
        selectedJobId !== "all" &&
        (!app.jobId || app.jobId._id !== selectedJobId)
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (sortOrder === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      } else if (sortOrder === "matchHigh") {
        return (b.matchPercentage || 0) - (a.matchPercentage || 0); // High to Low
      } else {
        return (a.matchPercentage || 0) - (b.matchPercentage || 0); // Low to High
      }
    });

  const selectedJob = jobs.find((job) => job._id === selectedJobId);

  const getJobsFromApplications = () => {
    const uniqueJobs = new Map();
    applications.forEach((app) => {
      if (app.jobId && app.jobId._id && !uniqueJobs.has(app.jobId._id)) {
        uniqueJobs.set(app.jobId._id, app.jobId);
      }
    });
    return Array.from(uniqueJobs.values());
  };

  const handleAddRequirement = () => {
    setJobForm({ ...jobForm, requirements: [...jobForm.requirements, ""] });
  };

  const handleRemoveRequirement = (index: number) => {
    const newReqs = jobForm.requirements.filter((_, i) => i !== index);
    setJobForm({ ...jobForm, requirements: newReqs });
  };

  const handleRequirementChange = (index: number, value: string) => {
    const newReqs = [...jobForm.requirements];
    newReqs[index] = value;
    setJobForm({ ...jobForm, requirements: newReqs });
  };

  const handleEditJob = (job: Job) => {
    setEditingJobId(job._id);
    setJobForm({
      title: job.title,
      description: job.description,
      requirements: job.requirements.length > 0 ? job.requirements : [""],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingJobId(null);
    setJobForm({ title: "", description: "", requirements: [""] });
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Энэ ажлын байрыг устгахдаа итгэлтэй байна уу?")) {
      return;
    }

    setDeletingJobId(jobId);
    try {
      const res = await fetch(`/api/jobs`, {
        method: "DELETE",
        body: JSON.stringify({ id: jobId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete job");
      }

      toast.success("Ажлын байр амжилттай устгагдлаа");
      fetchJobs();
    } catch {
      toast.error("Ажлын байр устгахад алдаа гарлаа");
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const filteredRequirements = jobForm.requirements.filter(
      (req) => req.trim() !== ""
    );

    if (
      !jobForm.title ||
      !jobForm.description ||
      filteredRequirements.length === 0
    ) {
      toast.error("Бүх талбарыг бөглөнө үү");
      setIsSubmitting(false);
      return;
    }

    try {
      const url = editingJobId ? `/api/jobs` : "/api/jobs";
      const method = editingJobId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingJobId,
          title: jobForm.title,
          description: jobForm.description,
          requirements: filteredRequirements,
        }),
      });

      if (!res.ok) {
        throw new Error(
          editingJobId ? "Failed to update job" : "Failed to create job"
        );
      }

      toast.success(
        editingJobId
          ? "Ажлын байр амжилттай шинэчлэгдлээ"
          : "Ажлын байр амжилттай үүслээ"
      );

      setJobForm({ title: "", description: "", requirements: [""] });
      setEditingJobId(null);
      fetchJobs();
    } catch {
      toast.error(
        editingJobId
          ? "Ажлын байр шинэчлэхэд алдаа гарлаа"
          : "Ажлын байр үүсгэхэд алдаа гарлаа"
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleDeleteApplication = async (id: string) => {
    if (!confirm("Энэ аппликейшнийг устгахдаа итгэлтэй байна уу?")) {
      return;
    }

    try {
      const res = await fetch(`/api/applications`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        throw new Error("Аппликейшн устгахад алдаа гарлаа");
      }
      setApplications((prev) => prev.filter((app) => app._id !== id));
      toast.success("Аппликейшн амжилттай устгагдлаа");
    } catch (error) {
      console.error("Аппликейшн устгах алдаа:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Аппликейшн устгахад алдаа гарлаа"
      );
    }
  };
  useEffect(() => {
    fetchApplications();
    fetchJobs();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between ">
          <div>
            <h1 className="text-3xl font-bold">SmartHire Admin Panel</h1>
            <p className="text-gray-600 mt-1">
              Ажлын байр болон аппликейшн удирдлага
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold ">{applications.length}</p>
              <p className="text-sm text-gray-500">Нийт CV</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div className="text-center">
              <p className="text-2xl font-bold">{jobs.length}</p>
              <p className="text-sm text-gray-500">Ажлын байр</p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCvModalOpen} onOpenChange={setIsCvModalOpen}>
        <DialogContent className="min-w-[40vw] min-h-[70vh] overflow-auto m-0">
          <DialogHeader className="">
            <DialogTitle className="flex justify-between items-center"></DialogTitle>
          </DialogHeader>
          {selectedCvUrl && (
            <div className="-mt-[30px]">
              {selectedCvUrl.endsWith(".pdf") ? (
                <embed
                  src={selectedCvUrl}
                  type="application/pdf"
                  width="100%"
                  height="600px"
                  className=""
                />
              ) : (
                <Image
                  width={1000}
                  height={600}
                  src={selectedCvUrl || "/placeholder.svg"}
                  alt="CV Preview"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div
        className="space-y-6 animate-fade-in-up max-w-6xl m-auto"
        style={{ animationDelay: "0.3s" }}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-2 w-full bg-white/50 backdrop-blur-sm h-14 p-1 rounded-xl shadow-lg border border-gray-100">
            <TabsTrigger
              value="applications"
              className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <Users className="w-5 h-5 mr-2" />
              <span className="font-medium">Аппликейшнууд</span>
              <Badge className="ml-2" variant="secondary">
                {applications.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="jobs"
              className="data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <Briefcase className="w-5 h-5 mr-2" />
              <span className="font-medium">Ажлын байрууд</span>
              <Badge className="ml-2" variant="secondary">
                {jobs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="applications" className="space-y-6">
            <div className="flex gap-6">
              {selectedJob && (
                <div className="w-65 flex-shrink-0 ">
                  <div className="sticky top-4">
                    <Card className="border-0 shadow-lg bg-white p-0 hover:shadow-xl transition-shadow duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Briefcase className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-lg">
                            Ажлын байрны мэдээлэл
                          </h3>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              {selectedJob.title}
                            </h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {selectedJob.description}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-gray-900 mb-3">
                              Шаардлагууд:
                            </h5>
                            <div className="space-y-2">
                              {selectedJob.requirements.map((req, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                                  <span className="text-sm text-gray-700">
                                    {req}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">Аппликейшн:</span>
                              <span className="font-medium text-blue-600">
                                {filteredApplications.length} CV
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Main Content */}
              <div className="flex-1 space-y-6">
                {/* Filters */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-4">
                      {/* Job Filter */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                          Ажлын байраар шүүх
                        </Label>
                        <Select
                          value={selectedJobId}
                          onValueChange={setSelectedJobId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Ажлын байр сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүх ажлын байр</SelectItem>
                            {getJobsFromApplications().map((job) => (
                              <SelectItem key={job._id} value={job._id}>
                                {job.title} {job.company && `- ${job.company}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Tabs
                        value={statusFilter}
                        onValueChange={(v) =>
                          setStatusFilter(
                            v as "all" | "shortlisted" | "pending"
                          )
                        }
                      >
                        <TabsList className="grid grid-cols-3 w-full bg-gray-100 h-12">
                          <TabsTrigger
                            value="all"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Бүгд ({filteredApplications.length})
                          </TabsTrigger>
                          <TabsTrigger
                            value="shortlisted"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Шигшигдсэн (
                            {
                              filteredApplications.filter(
                                (a) => a.status === "shortlisted"
                              ).length
                            }
                            )
                          </TabsTrigger>
                          <TabsTrigger
                            value="pending"
                            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all duration-200"
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Хүлээгдэж байгаа (
                            {
                              filteredApplications.filter(
                                (a) => a.status === "pending"
                              ).length
                            }
                            )
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="bookmarked-only"
                            checked={bookmarkedOnly}
                            onChange={() => setBookmarkedOnly(!bookmarkedOnly)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor="bookmarked-only"
                            className="flex items-center gap-2 text-sm font-medium text-gray-700"
                          >
                            {bookmarkedOnly ? (
                              <BookmarkCheck className="w-4 h-4 text-blue-500 fill-blue-500" />
                            ) : (
                              <Bookmark className="w-4 h-4 text-gray-400" />
                            )}
                            Зөвхөн bookmark хийсэн
                          </label>
                        </div>
                        <button
                          onClick={() =>
                            setSortOrder(
                              sortOrder === "matchHigh"
                                ? "matchLow"
                                : sortOrder === "matchLow"
                                ? "newest"
                                : "matchHigh"
                            )
                          }
                          className={`p-2 rounded-md transition-colors ${
                            sortOrder.includes("match")
                              ? "text-blue-600 bg-blue-50"
                              : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          }`}
                          title={
                            sortOrder === "matchHigh"
                              ? "High to Low"
                              : sortOrder === "matchLow"
                              ? "Low to High"
                              : "Sort by match score"
                          }
                        >
                          <TrendingUp
                            className={`w-4 h-4 ${
                              sortOrder === "matchLow"
                                ? "transform rotate-180"
                                : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={toggleSortOrder}
                          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                        >
                          <Calendar className="w-4 h-4" />
                          {sortOrder === "newest"
                            ? "Шинэ эхэнд"
                            : "Хуучин эхэнд"}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Өргөдлүүдийг ачаалж байна...
                      </p>
                    </div>
                  </div>
                ) : filteredApplications.length > 0 ? (
                  <div className="space-y-4">
                    {filteredApplications.map((application) => (
                      <Card
                        key={application._id}
                        className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-3">
                                <Badge variant="outline" className="text-xs">
                                  {application.jobId?.title || "Unknown Job"}
                                  {application.jobId?.company &&
                                    ` - ${application.jobId.company}`}
                                </Badge>
                              </div>
                              <div className="mb-4">
                                <div className="flex gap-2">
                                  <p className="text-gray-800 font-medium mb-2">
                                    {application.aiSummary.firstName}
                                  </p>
                                  <p className="text-gray-800 font-medium mb-2">
                                    {application.aiSummary.lastName}
                                  </p>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                  {application.aiSummary.summary}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {application.matchedSkills.map(
                                  (skill, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                                    >
                                      {skill}
                                    </span>
                                  )
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Илгээсэн {formatDate(application.createdAt)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <FileText className="w-4 h-4" />
                                  CV боломжтой
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-3 ml-6">
                              <div
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchColor(
                                  application.matchPercentage
                                )}`}
                              >
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4" />
                                  {application.matchPercentage !== undefined &&
                                  application.matchPercentage !== null
                                    ? `${application.matchPercentage}% тохирол`
                                    : "0% тохирол"}
                                </div>
                              </div>

                              {/* Status */}
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                  application.status
                                )}`}
                              >
                                {application.status.charAt(0).toUpperCase() +
                                  application.status.slice(1)}
                              </span>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    toggleBookmark(application._id)
                                  }
                                  disabled={updatingId === application._id}
                                  className={`p-2 rounded-md transition-colors ${
                                    application.bookmarked
                                      ? "text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
                                      : "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50"
                                  }`}
                                >
                                  {updatingId === application._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : application.bookmarked ? (
                                    <BookmarkCheck className="w-4 h-4" />
                                  ) : (
                                    <Bookmark className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() =>
                                    handleViewCv(application.cvUrl)
                                  }
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                  <Trash2
                                    className="w-4 h-4"
                                    onClick={() =>
                                      handleDeleteApplication(application._id)
                                    }
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-0 shadow-lg bg-white">
                    <CardContent className="text-center py-16">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 mb-4">
                        Ямар ч аппликейшн олдсонгүй
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStatusFilter("all");
                          setBookmarkedOnly(false);
                          setSelectedJobId("all");
                        }}
                      >
                        Шүүлтүүр цэвэрлэх
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="jobs" className="space-y-6">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">
                    {editingJobId
                      ? "Ажлын байр засах"
                      : "Шинэ ажлын байр нэмэх"}
                  </h2>
                  {editingJobId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Цуцлах
                    </Button>
                  )}
                </div>

                <form onSubmit={handleSubmitJob} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Ажлын байрны нэр</Label>
                    <Input
                      id="title"
                      value={jobForm.title}
                      onChange={(e) =>
                        setJobForm({ ...jobForm, title: e.target.value })
                      }
                      placeholder="Жишээ: Senior React Developer"
                      className="mt-1 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Тайлбар</Label>
                    <Textarea
                      id="description"
                      value={jobForm.description}
                      onChange={(e) =>
                        setJobForm({
                          ...jobForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ажлын байрны дэлгэрэнгүй тайлбар..."
                      className="mt-1 min-h-[100px] border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label>Шаардлагууд</Label>
                    <div className="space-y-2 mt-1">
                      {jobForm.requirements.map((req, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={req}
                            onChange={(e) =>
                              handleRequirementChange(index, e.target.value)
                            }
                            placeholder="Шаардлага оруулах"
                            className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          />
                          {jobForm.requirements.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveRequirement(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddRequirement}
                        className="mt-2 bg-transparent"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Шаардлага нэмэх
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant={"default"}
                    disabled={isSubmitting}
                    className="w-full text-white shadow-lg"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : editingJobId ? (
                      <Edit className="w-4 h-4 mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {editingJobId ? "Ажлын байр шинэчлэх" : "Ажлын байр үүсгэх"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Ажлын байрууд</h2>
                {jobs.length > 0 ? (
                  <div className="space-y-4">
                    {jobs.map((job, index) => (
                      <div
                        key={job._id}
                        className="border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 bg-white animate-fade-in-up"
                        style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">
                              {job.title}
                            </h3>
                            <p className="text-gray-600 mt-1">
                              {job.description}
                            </p>
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Шаардлагууд:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {job.requirements.map((req, index) => (
                                  <Badge key={index} variant="secondary">
                                    {req}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                              Үүсгэсэн: {formatDate(job.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditJob(job)}
                              disabled={editingJobId === job._id}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteJob(job._id)}
                              disabled={deletingJobId === job._id}
                            >
                              {deletingJobId === job._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    Одоогоор ажлын байр байхгүй байна
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
