import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Download, Users, GraduationCap, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';

interface UploadSummary {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}

const BulkUploadManagement = () => {
  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  const downloadTemplate = (type: 'students' | 'teachers') => {
    let data: any[] = [];
    let filename = '';

    if (type === 'students') {
      data = [{
        'Roll No': '1',
        'Full Name': 'Sita Sharma',
        'Gender': 'female',
        'Date of Birth': '2014-05-12',
        'Class': '5',
        'Section': 'B',
        'Phone (Family)': '9812345678',
        'Address': 'Dharan',
        'Parent Name': 'Ram Sharma',
        'Photo URL': ''
      }];
      filename = 'students_template.xlsx';
    } else {
      data = [{
        'Full Name': 'Ramesh Thapa',
        'Gender': 'male',
        'Subject 1': 'Science',
        'Subject 2': 'Math',
        'Class 1': '8',
        'Class 2': '9',
        'Phone': '9800001111',
        'Email': 'ramesh.thapa@school.edu.np',
        'Password': 'teacher123',
        'Address': 'Itahari',
        'Photo URL': ''
      }];
      filename = 'teachers_template.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'students' ? 'Students' : 'Teachers');
    XLSX.writeFile(wb, filename);

    toast({
      title: "Template Downloaded",
      description: `${filename} has been downloaded successfully.`,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'students' | 'teachers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(fileExt)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadSummary(null);

    try {
      // Read file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          setUploadProgress(30);

          // Process with AI validation
          const { data: validationResult, error } = await supabase.functions.invoke('process-bulk-upload', {
            body: { data: jsonData, type }
          });

          if (error) throw error;

          setUploadProgress(100);
          setUploadSummary(validationResult.summary);

          toast({
            title: "Upload Complete",
            description: `Successfully processed ${validationResult.summary.added} ${type}.`,
          });

        } catch (error: any) {
          console.error('Processing error:', error);
          toast({
            title: "Upload Failed",
            description: error.message || "Failed to process file.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error('File read error:', error);
      toast({
        title: "Error",
        description: "Failed to read file.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">📤 Bulk Data Upload</h1>
            <p className="text-muted-foreground">Upload students and teachers data from Excel/CSV files</p>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Upload...</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                {uploadProgress < 30 ? "Reading file..." : uploadProgress < 70 ? "Validating with AI..." : "Saving data..."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Summary */}
        {uploadSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{uploadSummary.total}</p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{uploadSummary.added}</p>
                  <p className="text-sm text-muted-foreground">Added</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{uploadSummary.skipped}</p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
              {uploadSummary.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Errors:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                    {uploadSummary.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Students Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Upload Students Data
            </CardTitle>
            <CardDescription>
              Upload student records from Excel or CSV file. Duplicates will be automatically skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate('students')}
                disabled={isUploading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e, 'students')}
                  disabled={isUploading}
                />
                <Button disabled={isUploading} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Students File
                  </span>
                </Button>
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Required fields:</strong> Roll No, Full Name, Gender, Date of Birth, Class, Section, Phone (Family)</p>
              <p><strong>Accepted formats:</strong> .xlsx, .xls, .csv (Max 10MB)</p>
            </div>
          </CardContent>
        </Card>

        {/* Teachers Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Upload Teachers Data
            </CardTitle>
            <CardDescription>
              Upload teacher records from Excel or CSV file. Duplicates will be automatically skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => downloadTemplate('teachers')}
                disabled={isUploading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleFileUpload(e, 'teachers')}
                  disabled={isUploading}
                />
                <Button disabled={isUploading} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Teachers File
                  </span>
                </Button>
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Required fields:</strong> Full Name, Gender, Subject, Class Assigned, Phone, Email, Password</p>
              <p><strong>Accepted formats:</strong> .xlsx, .xls, .csv (Max 10MB)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkUploadManagement;
