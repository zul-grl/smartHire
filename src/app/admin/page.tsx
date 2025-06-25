"use client";
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
  User,
  TrendingUp,
  Eye,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    mainSentence: string;
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

export default function ApplicationPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "shortlisted" | "pending"
  >("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to fetch applications");
      }
      const data = await res.json();
      console.log("Fetched applications:", data.data); // Debug
      setApplications(data.data || []);
    } catch (error) {
      console.error("Fetch error:", error); // Debug
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
        throw new Error("Application not found in state");
      }

      const newBookmarkStatus = !application.bookmarked;
      console.log("Toggling bookmark for ID:", id, "to:", newBookmarkStatus); // Debug

      const res = await fetch(`/api/applications/${id}/bookmark`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookmarked: newBookmarkStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update bookmark");
      }

      const data = await res.json();
      console.log("Updated application from server:", data.data); // Debug
      setApplications((prev) =>
        prev.map((app) => (app._id === id ? data.data : app))
      );
      toast.success(
        data.data.bookmarked ? "Bookmark хийгдлээ" : "Bookmark цуцлагдлаа"
      );
    } catch (error) {
      console.error("Bookmark error:", error); // Debug
      toast.error(
        error instanceof Error ? error.message : "Bookmark солиход алдаа гарлаа"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const updateStatus = async (id: string) => {
    setUpdatingId(id);
    try {
      const application = applications.find((app) => app._id === id);
      if (!application) {
        throw new Error("Application not found in state");
      }

      const newStatus =
        application.status === "shortlisted" ? "pending" : "shortlisted";
      console.log("Updating status for ID:", id, "to:", newStatus); // Debug

      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update status");
      }

      const data = await res.json();
      console.log("Updated application from server:", data.data); // Debug
      setApplications((prev) =>
        prev.map((app) => (app._id === id ? data.data : app))
      );
      toast.success(`Статус ${newStatus} болголоо`);
    } catch (error) {
      console.error("Status update error:", error); // Debug
      toast.error(
        error instanceof Error ? error.message : "Статус солиход алдаа гарлаа"
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
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  useEffect(() => {
    fetchApplications();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Аппликейшн удирдлага
        </h1>
        <p className="text-gray-600">CV-нуудын жагсаалт</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-2">
          <div className="flex flex-col space-y-4">
            <Tabs
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | "shortlisted" | "pending")
              }
            >
              <TabsList className="grid grid-cols-3 w-full bg-gray-100 h-12">
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-md"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Бүгд ({applications.length})
                </TabsTrigger>
                <TabsTrigger
                  value="shortlisted"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-md"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Shortlisted (
                  {
                    applications.filter((a) => a.status === "shortlisted")
                      .length
                  }
                  )
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="data-[state=active]:bg-white data-[state=active]:shadow-md"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Хүлээгдэж байгаа (
                  {applications.filter((a) => a.status === "pending").length})
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
                onClick={toggleSortOrder}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Calendar className="w-4 h-4" />
                {sortOrder === "newest" ? "Newest first" : "Oldest first"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application List */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
      ) : filteredApplications.length > 0 ? (
        <div className="divide-y divide-gray-200 bg-white rounded-lg shadow-sm">
          {filteredApplications.map((application) => (
            <div
              key={application._id}
              className="p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}

                  {/* AI Summary */}
                  <div className="mb-4">
                    <p className="text-gray-800 font-medium mb-2">
                      {application.aiSummary.mainSentence}
                    </p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {application.aiSummary.summary}
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {application.matchedSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Applied {formatDate(application.createdAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      CV Available
                    </div>
                  </div>
                </div>

                {/* Right side controls */}
                <div className="flex flex-col items-end gap-3 ml-6">
                  {/* Match percentage */}
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchColor(
                      application.matchPercentage
                    )}`}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {application.matchPercentage}% match
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
                      onClick={() => toggleBookmark(application._id)}
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
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(application.cvUrl, "_blank")}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title="View Original CV"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateStatus(application._id)}
                      disabled={updatingId === application._id}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        application.status === "pending"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-600 text-white hover:bg-gray-700"
                      }`}
                    >
                      {updatingId === application._id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : application.status === "pending" ? (
                        "Shortlist"
                      ) : (
                        "Unlist"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="text-center py-16">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-4">Ямар ч аппликейшн олдсонгүй</p>
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setBookmarkedOnly(false);
              }}
            >
              Шүүлтүүр цэвэрлэх
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
