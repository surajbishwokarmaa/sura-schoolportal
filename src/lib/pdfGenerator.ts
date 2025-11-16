interface StudentInfo {
  name: string;
  rollNo: string;
  class: string;
  section: string;
  photoUrl?: string | null;
}

interface ResultData {
  subject: string;
  theoryMarks: number;
  practicalMarks: number;
  totalMarks: number;
  grade: string;
  gpa: number;
}

interface MarksheetData {
  student: StudentInfo;
  results: ResultData[];
  term: string;
  academicYear: string;
  overallGPA: number;
  totalMarks: number;
  percentage: number;
  schoolInfo?: {
    name: string;
    address: string;
    logo?: string;
  };
}

export async function generateMarksheetPDF(data: MarksheetData): Promise<void> {
  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate PDF");
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Marksheet - ${data.student.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; background: white; }
    .marksheet { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 30px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .school-name { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
    .school-address { font-size: 14px; color: #666; margin-bottom: 15px; }
    .marksheet-title { font-size: 22px; font-weight: bold; text-transform: uppercase; background: #f0f0f0; padding: 10px; margin: 20px 0; }
    .student-info { display: grid; grid-template-columns: 1fr 150px; gap: 20px; margin-bottom: 20px; }
    .info-table { width: 100%; }
    .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-label { font-weight: bold; width: 150px; }
    .info-value { flex: 1; }
    .student-photo { width: 120px; height: 140px; border: 2px solid #333; object-fit: cover; }
    .results-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .results-table th, .results-table td { border: 1px solid #333; padding: 10px; text-align: center; }
    .results-table th { background: #f0f0f0; font-weight: bold; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 12px; color: #666; margin-bottom: 5px; }
    .summary-value { font-size: 20px; font-weight: bold; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature { text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
    @media print {
      body { padding: 0; }
      .marksheet { border: none; }
    }
  </style>
</head>
<body>
  <div class="marksheet">
    <div class="header">
      <div class="school-name">${data.schoolInfo?.name || "School Name"}</div>
      <div class="school-address">${data.schoolInfo?.address || "School Address"}</div>
      <div class="marksheet-title">Student Marksheet - ${data.term}</div>
      <div style="font-size: 14px; color: #666;">Academic Year: ${data.academicYear}</div>
    </div>

    <div class="student-info">
      <div class="info-table">
        <div class="info-row">
          <div class="info-label">Student Name:</div>
          <div class="info-value">${data.student.name}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Roll Number:</div>
          <div class="info-value">${data.student.rollNo}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Class:</div>
          <div class="info-value">${data.student.class}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Section:</div>
          <div class="info-value">${data.student.section}</div>
        </div>
      </div>
      ${data.student.photoUrl ? `<img src="${data.student.photoUrl}" class="student-photo" alt="Student Photo" />` : '<div class="student-photo" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0;">No Photo</div>'}
    </div>

    <table class="results-table">
      <thead>
        <tr>
          <th>S.N.</th>
          <th>Subject</th>
          <th>Theory</th>
          <th>Practical</th>
          <th>Total</th>
          <th>Grade</th>
          <th>GPA</th>
        </tr>
      </thead>
      <tbody>
        ${data.results.map((result, index) => `
          <tr>
            <td>${index + 1}</td>
            <td style="text-align: left;">${result.subject}</td>
            <td>${result.theoryMarks}</td>
            <td>${result.practicalMarks}</td>
            <td><strong>${result.totalMarks}</strong></td>
            <td><strong>${result.grade}</strong></td>
            <td>${result.gpa.toFixed(1)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Total Marks Obtained</div>
        <div class="summary-value">${data.totalMarks}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Overall GPA</div>
        <div class="summary-value">${data.overallGPA.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Percentage</div>
        <div class="summary-value">${data.percentage.toFixed(2)}%</div>
      </div>
    </div>

    <div class="footer">
      <div class="signature">
        <div class="signature-line">Class Teacher</div>
      </div>
      <div class="signature">
        <div class="signature-line">Principal</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 100);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
