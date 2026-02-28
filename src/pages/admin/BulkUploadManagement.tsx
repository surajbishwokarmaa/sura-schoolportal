import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Download, Users, GraduationCap, AlertCircle, FileSpreadsheet, CheckCircle2, Copy, Camera, ImagePlus } from "lucide-react";
import * as XLSX from 'xlsx';

interface UploadSummary {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
  credentials?: { name: string; loginId: string; password: string }[];
}

// Column definitions matching edge function expectations
const STUDENT_COLUMNS = ['student_name', 'roll_no', 'class', 'section', 'parent_mobile', 'gender', 'dob'];
const TEACHER_COLUMNS = ['teacher_name', 'phone_number', 'assigned_class', 'assigned_subject', 'password'];

// Batch size for processing large files - optimized for performance
const BATCH_SIZE = 50;

const BulkUploadManagement = () => {
  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoUploadStatus, setPhotoUploadStatus] = useState("");
  const studentPhotoRef = useRef<HTMLInputElement>(null);
  const teacherPhotoRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useCallback((type: 'students' | 'teachers') => {
    let headers: string[] = [];
    let sampleData: any[] = [];
    let filename = '';

    if (type === 'students') {
      headers = STUDENT_COLUMNS;
      sampleData = [
        {
          'student_name': 'Sita Sharma (DELETE THIS ROW)',
          'roll_no': '1',
          'class': 'Class 5',
          'section': 'Lotus',
          'parent_mobile': '9812345678',
          'gender': 'Female',
          'dob': '2014-05-12'
        },
        {
          'student_name': 'Ram Thapa',
          'roll_no': '2',
          'class': 'Class 10',
          'section': 'Rose',
          'parent_mobile': '9807470285',
          'gender': 'Male',
          'dob': '2010-08-20'
        },
        {
          'student_name': 'Hari Prasad',
          'roll_no': '1',
          'class': 'Class 11',
          'section': 'Lotus',
          'parent_mobile': '9841234567',
          'gender': 'Male',
          'dob': '2008-03-15'
        }
      ];
      filename = 'students_bulk_upload_format.xlsx';
    } else {
      headers = TEACHER_COLUMNS;
      sampleData = [
        {
          'teacher_name': 'Ramesh Thapa (DELETE THIS ROW)',
          'phone_number': '9800001111',
          'assigned_class': 'Class 5, Class 6',
          'assigned_subject': 'Math, Science',
          'password': 'mypassword123'
        },
        {
          'teacher_name': 'Gita Sharma',
          'phone_number': '9812223333',
          'assigned_class': 'Class 11, Class 12',
          'assigned_subject': 'Physics, Chemistry',
          'password': 'teachergita456'
        }
      ];
      filename = 'teachers_bulk_upload_format.xlsx';
    }

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 10, 25) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'students' ? 'Students' : 'Teachers');
    
    // Use blob-based download for better browser compatibility
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: `Use this exact format. Delete sample rows before uploading real data.`,
    });
  }, []);

  const validateColumns = useCallback((uploadedColumns: string[], requiredColumns: string[]): { valid: boolean; missing: string[] } => {
    const normalizedUploaded = uploadedColumns.map(c => c.toString().toLowerCase().trim().replace(/\s+/g, '_'));
    const missing = requiredColumns.filter(col => {
      const normalizedCol = col.toLowerCase();
      return !normalizedUploaded.includes(normalizedCol);
    });
    return { valid: missing.length === 0, missing };
  }, []);

  // Process data in batches for better performance
  const processBatches = useCallback(async (jsonData: any[], type: 'students' | 'teachers'): Promise<UploadSummary> => {
    const totalRecords = jsonData.length;
    const batches = Math.ceil(totalRecords / BATCH_SIZE);
    let totalAdded = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];
    const allCredentials: { name: string; loginId: string; password: string }[] = [];

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalRecords);
      const batch = jsonData.slice(start, end);

      setProcessingStatus(`Processing batch ${i + 1}/${batches} (records ${start + 1}-${end} of ${totalRecords})`);
      setUploadProgress(20 + Math.floor((i / batches) * 70));

      try {
        const { data: result, error } = await supabase.functions.invoke('process-bulk-upload', {
          body: { data: batch, type }
        });

        if (error) {
          console.error('Batch error:', error);
          allErrors.push(`Batch ${i + 1} failed: ${error.message || 'Network error'}`);
          totalSkipped += batch.length;
          continue;
        }

        if (result?.summary) {
      totalAdded += result.summary.added || 0;
      // Keep internal skipped count for backend batching, but we won't show it in UI
      totalSkipped += result.summary.skipped || 0;
      if (result.summary.errors?.length > 0) {
        allErrors.push(...result.summary.errors.slice(0, 10));
      }
      if (result.summary.credentials?.length > 0) {
        allCredentials.push(...result.summary.credentials);
      }
        }
      } catch (error: any) {
        console.error('Batch processing error:', error);
        allErrors.push(`Batch ${i + 1} failed: ${error.message || 'Unknown error'}`);
        totalSkipped += batch.length;
      }

      // Small delay between batches to prevent overwhelming the server
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      total: totalRecords,
      added: totalAdded,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 30),
      credentials: allCredentials
    };
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, type: 'students' | 'teachers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size limit (25MB)
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
    setShowCredentials(false);
    setProcessingStatus("Reading file...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setProcessingStatus("Parsing Excel data...");
          setUploadProgress(10);

          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

          if (jsonData.length === 0) {
            throw new Error("The uploaded file is empty. Please add data and try again.");
          }

          if (jsonData.length > 3000) {
            throw new Error("Maximum 3000 records allowed per upload. Please split your file into smaller parts.");
          }

          setProcessingStatus(`Found ${jsonData.length} records. Validating columns...`);
          setUploadProgress(15);

          // Normalize column names in the data
          const normalizedData = jsonData.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
              normalized[normalizedKey] = row[key];
            });
            return normalized;
          });

          const uploadedColumns = Object.keys(normalizedData[0] || {});
          const requiredColumns = type === 'students' ? STUDENT_COLUMNS : TEACHER_COLUMNS;
          
          // For teachers, password is optional
          const columnsToValidate = type === 'teachers' 
            ? requiredColumns.filter(c => c !== 'password')
            : requiredColumns;
          
          const validation = validateColumns(uploadedColumns, columnsToValidate);

          if (!validation.valid) {
            throw new Error(
              `Missing required columns: ${validation.missing.join(', ')}. ` +
              `Please download the template and use the exact column headers.`
            );
          }

          setProcessingStatus(`Uploading ${jsonData.length} ${type}...`);

          // Process in batches
          const summary = await processBatches(normalizedData, type);

          setUploadProgress(100);
          setProcessingStatus("Complete!");
          setUploadSummary(summary);

          if (summary.added > 0) {
            toast({
              title: "Upload Successful!",
              description: `Added ${summary.added} ${type} out of ${summary.total} records.`,
            });
          } else {
            toast({
              title: "Upload Completed",
              description: summary.errors.length
                ? `No records were added. Please check the error list below.`
                : `No records were added. Please verify the Excel data and try again.`,
              variant: summary.errors.length ? "destructive" : undefined,
              duration: 8000,
            });
          }

        } catch (error: any) {
          console.error('Processing error:', error);
          toast({
            title: "Upload Failed",
            description: error.message || "Failed to process file. Please check the format.",
            variant: "destructive",
          });
          setUploadSummary({
            total: 0,
            added: 0,
            skipped: 0,
            errors: [error.message || "Unknown error"]
          });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
          setProcessingStatus("");
        }
      };

      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read file. Please try again.",
          variant: "destructive",
        });
        setIsUploading(false);
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

  const copyCredentialsToClipboard = useCallback(() => {
    if (!uploadSummary?.credentials?.length) return;
    
    const text = uploadSummary.credentials.map(c => 
      `Name: ${c.name}\nLogin ID: ${c.loginId}\nPassword: ${c.password}\n`
    ).join('\n---\n');
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Credentials copied to clipboard.",
    });
  }, [uploadSummary]);

  const handleBulkPhotoUpload = useCallback(async (files: FileList, type: 'students' | 'teachers') => {
    if (files.length === 0) return;

    setIsUploadingPhotos(true);
    setPhotoUploadProgress(0);
    const bucket = type === 'students' ? 'student-photos' : 'teacher-photos';
    let matched = 0;
    let failed = 0;
    const errors: string[] = [];

    if (type === 'students') {
      const { data: students } = await supabase.from('students').select('id, name, class, roll_no');
      if (!students || students.length === 0) {
        toast({ title: 'Error', description: 'No students found. Upload student data first.', variant: 'destructive' });
        setIsUploadingPhotos(false);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setPhotoUploadStatus(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        setPhotoUploadProgress(Math.floor((i / files.length) * 100));

        if (!file.type.startsWith('image/')) { errors.push(`${file.name}: Not an image`); failed++; continue; }
        if (file.size > 2 * 1024 * 1024) { errors.push(`${file.name}: Over 2MB`); failed++; continue; }

        // Filename format: Class5_1.jpg (class_rollno)
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        const parts = nameWithoutExt.split('_');
        let student = null;
        if (parts.length >= 2) {
          const classPattern = parts.slice(0, -1).join(' ').toLowerCase().replace(/\s+/g, '');
          const rollNo = parts[parts.length - 1].trim();
          student = students.find(s => s.class.toLowerCase().replace(/\s+/g, '') === classPattern && s.roll_no === rollNo);
        }
        if (!student) { errors.push(`${file.name}: No match. Use Class5_1.jpg format`); failed++; continue; }

        const ext = file.name.split('.').pop();
        const filePath = `${student.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
        if (upErr) { errors.push(`${file.name}: ${upErr.message}`); failed++; continue; }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        await supabase.from('students').update({ photo_url: urlData.publicUrl }).eq('id', student.id);
        matched++;
      }
    } else {
      const { data: teachers } = await supabase.from('teachers').select('id, name');
      if (!teachers || teachers.length === 0) {
        toast({ title: 'Error', description: 'No teachers found. Upload teacher data first.', variant: 'destructive' });
        setIsUploadingPhotos(false);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setPhotoUploadStatus(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        setPhotoUploadProgress(Math.floor((i / files.length) * 100));

        if (!file.type.startsWith('image/')) { errors.push(`${file.name}: Not an image`); failed++; continue; }
        if (file.size > 2 * 1024 * 1024) { errors.push(`${file.name}: Over 2MB`); failed++; continue; }

        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim().toLowerCase();
        const teacher = teachers.find(t => t.name.toLowerCase().trim() === nameWithoutExt);
        if (!teacher) { errors.push(`${file.name}: No matching teacher`); failed++; continue; }

        const ext = file.name.split('.').pop();
        const filePath = `${teacher.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
        if (upErr) { errors.push(`${file.name}: ${upErr.message}`); failed++; continue; }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        await supabase.from('teachers').update({ photo_url: urlData.publicUrl }).eq('id', teacher.id);
        matched++;
      }
    }

    setPhotoUploadProgress(100);
    setPhotoUploadStatus("");
    setIsUploadingPhotos(false);
    if (studentPhotoRef.current) studentPhotoRef.current.value = '';
    if (teacherPhotoRef.current) teacherPhotoRef.current.value = '';

    toast({
      title: matched > 0 ? 'Photos Uploaded!' : 'No Photos Matched',
      description: `${matched} matched, ${failed} failed out of ${files.length} files.${errors.length > 0 ? ' Errors: ' + errors.slice(0, 3).join('; ') : ''}`,
      variant: matched > 0 ? undefined : 'destructive',
      duration: 10000,
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
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
              Upload up to 2500+ students or teachers from Excel/CSV files
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Processing Upload...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={uploadProgress} className="w-full h-2 sm:h-3" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                {processingStatus || "Initializing..."}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {uploadProgress}% complete - Please do not close this page
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Summary */}
        {uploadSummary && (
          <Card className={uploadSummary.added > 0 ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                {uploadSummary.added > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                Upload Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-primary">{uploadSummary.total}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <p className="text-lg sm:text-2xl font-bold text-green-600">{uploadSummary.added}</p>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Added</p>
                </div>
              </div>

              {/* Credentials Section */}
              {uploadSummary.credentials && uploadSummary.credentials.length > 0 && (
                <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 text-sm">
                      📋 Generated Credentials ({uploadSummary.credentials.length})
                    </h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowCredentials(!showCredentials)}>
                        {showCredentials ? 'Hide' : 'Show'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={copyCredentialsToClipboard}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy All
                      </Button>
                    </div>
                  </div>
                  {showCredentials && (
                    <div className="max-h-48 overflow-y-auto text-xs space-y-2">
                      {uploadSummary.credentials.map((cred, idx) => (
                        <div key={idx} className="bg-background p-2 rounded border">
                          <p><strong>{cred.name}</strong></p>
                          <p className="text-muted-foreground">Login ID: {cred.loginId}</p>
                          <p className="text-muted-foreground">Password: {cred.password}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Errors Section */}
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

        {/* Upload Cards */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Students Upload */}
          <Card className="h-fit">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Upload Students
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Bulk upload student records. Duplicates are auto-skipped.
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
                  Download Template
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
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-2">
                <p className="font-medium">📋 Required columns:</p>
                <div className="flex flex-wrap gap-1">
                  {STUDENT_COLUMNS.map(col => (
                    <code key={col} className="text-[10px] sm:text-xs bg-background px-1.5 py-0.5 rounded">
                      {col}
                    </code>
                  ))}
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-[10px] sm:text-xs">
                    <strong>🔐 Password Rule:</strong> Auto-generated as <code className="bg-background px-1 rounded">sura</code> + first 2 digits + last 2 digits of parent mobile
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/80">
                    Example: Mobile 9807470285 → Password: <code className="bg-background px-1 rounded">sura9885</code>
                  </p>
                </div>
                <p className="text-[10px] sm:text-xs pt-1">
                  <strong>Limits:</strong> Max 2500+ records | 25MB | .xlsx, .xls, .csv
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
                Bulk upload teacher records with custom passwords.
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
                  Download Template
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
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-2">
                <p className="font-medium">📋 Required columns:</p>
                <div className="flex flex-wrap gap-1">
                  {TEACHER_COLUMNS.map(col => (
                    <code key={col} className="text-[10px] sm:text-xs bg-background px-1.5 py-0.5 rounded">
                      {col}{col === 'password' && ' (optional)'}
                    </code>
                  ))}
                </div>
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-[10px] sm:text-xs">
                    <strong>🔐 Password:</strong> Set in Excel column. If empty, auto-generated as <code className="bg-background px-1 rounded">teacher</code> + last 4 digits of phone
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/80">
                    💡 Multiple classes/subjects: separate with commas (e.g., "Grade 5, Grade 6")
                  </p>
                </div>
                <p className="text-[10px] sm:text-xs pt-1">
                  <strong>Limits:</strong> Max 2500+ records | 25MB
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Photo Upload Progress */}
        {isUploadingPhotos && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Uploading Photos...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={photoUploadProgress} className="w-full h-2" />
              <p className="text-xs text-muted-foreground">{photoUploadStatus}</p>
            </CardContent>
          </Card>
        )}

        {/* Bulk Photo Upload */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Student Photos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload multiple student photos. Matched by filename.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={studentPhotoRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleBulkPhotoUpload(e.target.files, 'students')}
              />
              <Button
                size="sm"
                disabled={isUploadingPhotos || isUploading}
                onClick={() => studentPhotoRef.current?.click()}
                className="w-full text-xs sm:text-sm"
              >
                <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Select Student Photos
              </Button>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-1">
                <p className="font-medium">📸 Filename format:</p>
                <p><code className="bg-background px-1 rounded">Class5_1.jpg</code> → Class 5, Roll No 1</p>
                <p><code className="bg-background px-1 rounded">Class10_15.png</code> → Class 10, Roll No 15</p>
                <p className="pt-1 text-muted-foreground/80">Max 2MB per photo • JPG, PNG supported</p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Teacher Photos
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload multiple teacher photos. Matched by full name.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={teacherPhotoRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleBulkPhotoUpload(e.target.files, 'teachers')}
              />
              <Button
                size="sm"
                disabled={isUploadingPhotos || isUploading}
                onClick={() => teacherPhotoRef.current?.click()}
                className="w-full text-xs sm:text-sm"
              >
                <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Select Teacher Photos
              </Button>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md space-y-1">
                <p className="font-medium">📸 Filename format:</p>
                <p><code className="bg-background px-1 rounded">Ramesh_Thapa.jpg</code> → Teacher "Ramesh Thapa"</p>
                <p><code className="bg-background px-1 rounded">Gita_Sharma.png</code> → Teacher "Gita Sharma"</p>
                <p className="pt-1 text-muted-foreground/80">Use underscores for spaces • Max 2MB per photo</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadManagement;
