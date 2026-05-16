import fs from 'fs';

const content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<Tabs.Content value="history"'));
const endIndex = lines.findIndex(l => l.includes('<Tabs.Content value="salary_old"'));

if (startIndex !== -1 && endIndex !== -1) {
    const tabLines = lines.slice(startIndex, endIndex);

    const componentContent = `import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { History, Building, Calendar, Wallet, Trash2, Plus } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function HistoryTab() {
  const { form, currentMode, isSuperAdmin, employmentHistory, setEmploymentHistory, addHistory, removeHistory } = useEmployeeForm();
  
  return (
    <FormProvider {...form}>
${tabLines.map(line => '      ' + line).join('\n')}
    </FormProvider>
  );
}
`;

    fs.writeFileSync('src/pages/employee/components/HistoryTab.tsx', componentContent);
    console.log("HistoryTab.tsx created");
    
    // Modify EmployeeMaster
    const newOriginalLines = [
        ...lines.slice(0, startIndex),
        `                  <HistoryTab />`,
        ...lines.slice(endIndex)
    ];

    fs.writeFileSync('src/pages/employee/EmployeeMaster.tsx', newOriginalLines.join('\n'));
    console.log("EmployeeMaster.tsx updated");
} else {
    console.log("Could not find boundaries", startIndex, endIndex);
}
