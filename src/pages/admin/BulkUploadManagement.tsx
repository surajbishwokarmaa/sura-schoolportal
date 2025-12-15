import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Download, Users, GraduationCap, AlertCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface UploadSummary {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}

const STUDENT_COLUMNS = ['student_name', 'roll_no', 'class', 'section', 'parent_mobile', 'gender', 'dob', 'status'];
const TEACHER_COLUMNS = ['teacher_name', 'phone_number', 'assigned_class', 'assigned_subject'];

// Batch size for processing large files
const BATCH_SIZE = 100;

const BulkUploadManagement = () => {
  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");

  const downloadTemplate = useCallback((type: 'students' | 'teachers') => {
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

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'students' ? 'Students' : 'Teachers');
    XLSX.writeFile(wb, filename);

    toast({
      title: "Excel Format Downloaded",
      description: `Use this exact format for uploading ${type}. Delete the sample row before uploading.`,
    });
  }, []);

  const validateColumns = useCallback((uploadedColumns: string[], requiredColumns: string[]): { valid: boolean; missing: string[] } => {
    const normalizedUploaded = uploadedColumns.map(c => c.toString().toLowerCase().trim());
    const missing = requiredColumns.filter(col => !normalizedUploaded.includes(col.toLowerCase()));
    return { valid: missing.length === 0, missing };
  }, []);

  // Process data in batches for better performance
  const processBatches = useCallback(async (jsonData: any[], type: 'students' | 'teachers') => {
    const totalRecords = jsonData.length;
    const batches = Math.ceil(totalRecords / BATCH_SIZE);
    let totalAdded = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalRecords);
      const batch = jsonData.slice(start, end);

      setProcessingStatus(`Processing batch ${i + 1}/${batches} (${start + 1}-${end} of ${totalRecords})`);
      setUploadProgress(30 + Math.floor((i / batches) * 60));

      try {
        const { data: validationResult, error } = await supabase.functions.invoke('process-bulk-upload', {
          body: { data: batch, type }
        });

        if (error) throw error;

        totalAdded += validationResult.summary?.added || 0;
        totalSkipped += validationResult.summary?.skipped || 0;
        if (validationResult.summary?.errors) {
          allErrors.push(...validationResult.summary.errors.slice(0, 5)); // Limit errors per batch
        }
      } catch (error: any) {
        allErrors.push(`Batch ${i + 1} failed: ${error.message}`);
      }

      // Small delay between batches to prevent overwhelming the server
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      total: totalRecords,
      added: totalAdded,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 20) // Limit total errors shown
    };
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, type: 'students' | 'teachers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Increased file size limit for larger datasets (25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 25MB.",
        variant: "destructive",
      });
      return;
    }

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
    setUploadProgress(5);
    setUploadSummary(null);
    setProcessingStatus("Reading file...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setProcessingStatus("Parsing Excel data...");
          setUploadProgress(15);

          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            throw new Error("The uploaded file is empty. Please add data and try again.");
          }

          if (jsonData.length > 3000) {
            throw new Error("Maximum 3000 records allowed per upload. Please split your file.");
          }

          setProcessingStatus(`Found ${jsonData.length} records. Validating columns...`);
          setUploadProgress(25);

          const uploadedColumns = Object.keys(jsonData[0] as object);
          const requiredColumns = type === 'students' ? STUDENT_COLUMNS : TEACHER_COLUMNS;
          const validation = validateColumns(uploadedColumns, requiredColumns);

          if (!validation.valid) {
            throw new Error(
              `Uploaded file does not match system format. Missing columns: ${validation.missing.join(', ')}. ` +
              `Please download the correct format and try again.`
            );
          }

          // Process in batches for large files
          const summary = await processBatches(jsonData, type);

          setUploadProgress(100);
          setProcessingStatus("Complete!");
          setUploadSummary(summary);

          toast({
            title: "Upload Complete",
            description: `Successfully processed ${summary.added} ${type} out of ${summary.total} records.`,
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
          setProcessingStatus("");
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
      setProcessingStatus("");
    }

    // Reset input
    event.target.value = '';
  }, [validateColumns, processBatches]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
              Bulk Data Upload
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upload up to 2500+ records from Excel/CSV files
            </p>
          </div>
        </div>

        {/* Upload Progress - Responsive */}
        {isUploading && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Processing Upload...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={uploadProgress} className="w-full h-2 sm:h-3" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                {processingStatus || "Initializing..."}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {uploadProgress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Summary - Responsive Grid */}
        {uploadSummary && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Upload Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-primary">{uploadSummary.total}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{uploadSummary.added}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Added</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-yellow-600">{uploadSummary.skipped}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
              {uploadSummary.errors.length > 0 && (
                <div className="mt-3 p-2 sm:p-3 bg-destructive/10 rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2 text-destructive text-xs sm:text-sm">
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    Errors ({uploadSummary.errors.length}):
                  </h4>
                  <ul className="list-disc list-inside text-[10px] sm:text-xs text-muted-foreground mt-2 max-h-32 overflow-y-auto">
                    {uploadSummary.errors.map((error, idx) => (
                      <li key={idx} className="truncate">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upload Cards - Responsive */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Students Upload */}
          <Card className="h-fit">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Upload Students
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload student records. Duplicates auto-skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('students')}
                  disabled={isUploading}
                  className="flex-1 text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Download Format
                </Button>
                <label className="cursor-pointer flex-1">
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileUpload(e, 'students')}
                    disabled={isUploading}
                  />
                  <Button disabled={isUploading} size="sm" className="w-full text-xs sm:text-sm" asChild>
                    <span>
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Upload File
                    </span>
                  </Button>
                </label>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-1">
                <p className="font-medium">📋 Required columns:</p>
                <div className="flex flex-wrap gap-1">
                  {STUDENT_COLUMNS.map(col => (
                    <code key={col} className="text-[10px] sm:text-xs bg-background px-1.5 py-0.5 rounded">
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] sm:text-xs pt-1">
                  <strong>Max:</strong> 2500+ records | <strong>Size:</strong> 25MB | <strong>Format:</strong> .xlsx, .xls, .csv
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Teachers Upload */}
          <Card className="h-fit">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Upload Teachers
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload teacher records. Duplicates auto-skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTemplate('teachers')}
                  disabled={isUploading}
                  className="flex-1 text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Download Format
                </Button>
                <label className="cursor-pointer flex-1">
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileUpload(e, 'teachers')}
                    disabled={isUploading}
                  />
                  <Button disabled={isUploading} size="sm" className="w-full text-xs sm:text-sm" asChild>
                    <span>
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Upload File
                    </span>
                  </Button>
                </label>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-1">
                <p className="font-medium">📋 Required columns:</p>
                <div className="flex flex-wrap gap-1">
                  {TEACHER_COLUMNS.map(col => (
                    <code key={col} className="text-[10px] sm:text-xs bg-background px-1.5 py-0.5 rounded">
                      {col}
                    </code>
                  ))}
                </div>
                <p className="text-[10px] sm:text-xs pt-1">
                  <strong>Max:</strong> 2500+ records | <strong>Size:</strong> 25MB
                </p>
                <p className="text-[10px] sm:text-xs">
                  💡 Multiple classes/subjects: separate with commas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadManagement;
