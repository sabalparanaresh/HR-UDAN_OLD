import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace unprotected transaction routes with ProtectedRoute
content = content.replace(
  /<Route path="salary" element=\{<SalaryProcessing currentUser=\{currentUser\} \/>\} \/>/g,
  '<Route path="salary" element={<ProtectedRoute moduleCode="K" pageKey="salary" currentUser={currentUser}><SalaryProcessing currentUser={currentUser} /></ProtectedRoute>} />'
);

content = content.replace(
  /<Route path="advance" element=\{<AdvanceProcessing currentUser=\{currentUser\} \/>\} \/>/g,
  '<Route path="advance" element={<ProtectedRoute moduleCode="K" pageKey="advance" currentUser={currentUser}><AdvanceProcessing currentUser={currentUser} /></ProtectedRoute>} />'
);

content = content.replace(
  /<Route path="rokda-management" element=\{<RokdaManagement currentUser=\{currentUser\} onRedirect=\{\(\) => \{\}\} \/>\} \/>/g,
  '<Route path="rokda-management" element={<ProtectedRoute moduleCode="K" pageKey="rokdaManagement" currentUser={currentUser}><RokdaManagement currentUser={currentUser} onRedirect={() => {}} /></ProtectedRoute>} />'
);

content = content.replace(
  /<Route path="cash-management" element=\{<CashManagement currentUser=\{currentUser\} onRedirect=\{\(\) => \{\}\} \/>\} \/>/g,
  '<Route path="cash-management" element={<ProtectedRoute moduleCode="K" pageKey="cashManagement" currentUser={currentUser}><CashManagement currentUser={currentUser} onRedirect={() => {}} /></ProtectedRoute>} />'
);

content = content.replace(
  /<Route path="daily-mis" element=\{<DailyMISManagement currentUser=\{currentUser\} onRedirect=\{\(\) => \{\}\} \/>\} \/>/g,
  '<Route path="daily-mis" element={<ProtectedRoute moduleCode="K" pageKey="dailyMis" currentUser={currentUser}><DailyMISManagement currentUser={currentUser} onRedirect={() => {}} /></ProtectedRoute>} />'
);

// Reports
content = content.replace(
  /<Route path="engine" element=\{<ReportsEngine currentUser=\{currentUser\} onRedirect=\{\(\) => \{\}\} \/>\} \/>/g,
  '<Route path="engine" element={<ProtectedRoute currentUser={currentUser} moduleCode="*" pageKey="reportsEngine"><ReportsEngine currentUser={currentUser} onRedirect={() => {}} /></ProtectedRoute>} />'
);

content = content.replace(
  /<Route path="dashboard" element=\{<DashboardEngine currentUser=\{currentUser\} onRedirect=\{\(\) => \{\}\} \/>\} \/>/g,
  '<Route path="dashboard" element={<ProtectedRoute currentUser={currentUser} moduleCode="*" pageKey="dashboard"><DashboardEngine currentUser={currentUser} onRedirect={() => {}} /></ProtectedRoute>} />'
);

fs.writeFileSync(file, content);
console.log('App.tsx updated');
