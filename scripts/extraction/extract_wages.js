import fs from 'fs';

const content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<Tabs.Content value="wages"'));
const endIndex = lines.findIndex(l => l.includes('<Tabs.Content value="docs"'));

if (startIndex !== -1 && endIndex !== -1) {
    const tabLines = lines.slice(startIndex, endIndex);

    const componentContent = `import React, { useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { Wallet, Calculator, Info } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { SearchableSelect } from '../../../components/SearchableSelect';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SlabComponent, SalaryHead } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function WagesTab() {
  const { 
    form, currentMode, isSuperAdmin, 
    weeklyOffDays, selectedEmployeeId, 
    pfUanValue, esicNoValue,
    slabs, slabsLoading, handleSlabChange,
    selectedSlabDetails, statutoryCTC,
    dailyWages, pieceRate,
    ptEligibility, esiEligibility, pfEligibility, minimumWagesEligibility, bonusEligibility
  } = useEmployeeForm();
  
  const { register, formState: { errors }, watch, setValue } = form;

  const wageTypeValue = watch('wage_type');
  const selectedSlabId = watch('slab_id');

  return (
    <FormProvider {...form}>
${tabLines.map(line => '      ' + line).join('\n')}
    </FormProvider>
  );
}
`;

    fs.writeFileSync('src/pages/employee/components/WagesTab.tsx', componentContent);
    console.log("WagesTab.tsx created");
    
    // Modify EmployeeMaster
    const newOriginalLines = [
        ...lines.slice(0, startIndex),
        `                  <WagesTab />`,
        ...lines.slice(endIndex)
    ];

    fs.writeFileSync('src/pages/employee/EmployeeMaster.tsx', newOriginalLines.join('\n'));
    console.log("EmployeeMaster.tsx updated");
} else {
    console.log("Could not find boundaries", startIndex, endIndex);
}
