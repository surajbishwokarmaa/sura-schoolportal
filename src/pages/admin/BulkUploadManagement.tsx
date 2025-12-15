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

  // Required columns for validation
  const STUDENT_COLUMNS = ['student_name', 'roll_no', 'class', 'section', 'parent_mobile', 'gender', 'dob', 'status'];
  const TEACHER_COLUMNS = ['teacher_name', 'phone_number', 'assigned_class', 'assigned_subject'];

  const downloadTemplate = (type: 'students' | 'teachers') => {
    let headers: string[] = [];
    let sampleData: any[] = [];
    let filename = '';

    if (type === 'students') {
      headers = STUDENT_COLUMNS;
      sampleData = [{
        'student_name': 'Sita Sharma (SAMPLE - DELETE THIS ROW)',
        'roll_no': 1,
        'class': 5,
        'section': 'A',
        'parent_mobile': 9812345678,
        'gender': 'Female',
        'dob': '2014-05-12',
        'status': 'Active'
      }];
      filename = 'students_bulk_upload_format.xlsx';
    } else {
      headers = TEACHER_COLUMNS;
      sampleData = [{
        'teacher_name': 'Ramesh Thapa (SAMPLE - DELETE THIS ROW)',
        'phone_number': 9800001111,
        'assigned_class': 'Grade 5, Grade 6',
        'assigned_subject': 'Math, Science'
      }];
      filename = 'teachers_bulk_upload_format.xlsx';
    }

    // Create worksheet with headers in exact order
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    
    // Set column widths for better readability
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'students' ? 'Students' : 'Teachers');
    XLSX.writeFile(wb, filename);

    toast({
      title: "Excel Format Downloaded",
      description: `Use this exact format for uploading ${type}. Delete the sample row before uploading.`,
    });
  };

  const validateColumns = (uploadedColumns: string[], requiredColumns: string[]): { valid: boolean; missing: string[] } => {
    const normalizedUploaded = uploadedColumns.map(c => c.toString().toLowerCase().trim());
    const missing = requiredColumns.filter(col => !normalizedUploaded.includes(col.toLowerCase()));
    return { valid: missing.length === 0, missing };
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

          if (jsonData.length === 0) {
            throw new Error("The uploaded file is empty. Please add data and try again.");
          }

          // Validate column structure
          const uploadedColumns = Object.keys(jsonData[0] as object);
          const requiredColumns = type === 'students' ? STUDENT_COLUMNS : TEACHER_COLUMNS;
          const validation = validateColumns(uploadedColumns, requiredColumns);

          if (!validation.valid) {
            throw new Error(
              `Uploaded file does not match system format. Missing columns: ${validation.missing.join(', ')}. ` +
              `Please download the correct format and try again.`
            );
          }

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
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <p className="font-medium mb-1">📋 Required columns (exact names):</p>
              <code className="text-xs bg-background px-2 py-1 rounded">
                {STUDENT_COLUMNS.join(' | ')}
              </code>
              <p className="mt-2"><strong>Accepted formats:</strong> .xlsx, .xls, .csv (Max 10MB, up to 1400+ records)</p>
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
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              <p className="font-medium mb-1">📋 Required columns (exact names):</p>
              <code className="text-xs bg-background px-2 py-1 rounded">
                {TEACHER_COLUMNS.join(' | ')}
              </code>
              <p className="mt-2"><strong>Accepted formats:</strong> .xlsx, .xls, .csv (Max 10MB, up to 1400+ records)</p>
              <p className="mt-1 text-xs">💡 For multiple classes/subjects, separate with commas (e.g., "Grade 5, Grade 6")</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkUploadManagement;
