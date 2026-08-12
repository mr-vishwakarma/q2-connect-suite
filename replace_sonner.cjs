const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/student/Suggestions.tsx',
  'src/pages/student/StudentDashboard.tsx',
  'src/pages/student/Profile.tsx',
  'src/pages/student/MessOff.tsx',
  'src/pages/student/Complaints.tsx',
  'src/pages/ResetPassword.tsx',
  'src/pages/RegisterAdmin.tsx',
  'src/pages/Login.tsx',
  'src/pages/ForgotPassword.tsx',
  'src/pages/Contact.tsx',
  'src/pages/AdminLogin.tsx',
  'src/pages/admin/RoomManagement.tsx',
  'src/pages/admin/RegisterStudent.tsx',
  'src/pages/admin/Notifications.tsx',
  'src/pages/admin/LeaveRequests.tsx',
  'src/pages/admin/FeeManagement.tsx',
  'src/pages/admin/AllStudents.tsx',
  'src/pages/admin/AdminSuggestions.tsx',
  'src/pages/admin/AdminManagement.tsx',
  'src/pages/admin/AdminComplaints.tsx',
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(/import\s+{\s*toast\s*}\s+from\s+['"]sonner['"];/g, "import { toast } from 'react-toastify';");
  fs.writeFileSync(fullPath, content);
  console.log('Updated ' + file);
});
