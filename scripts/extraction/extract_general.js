import fs from 'fs';

const content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<Tabs.Content value="general"'));
const endIndex = lines.findIndex(l => l.includes('<Tabs.Content value="employment"'));

if (startIndex !== -1 && endIndex !== -1) {
    const tabLines = lines.slice(startIndex, endIndex);

    const componentContent = `import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FormProvider } from 'react-hook-form';
import { Camera, Image as ImageIcon, MapPin, Search } from 'lucide-react';
import { useEmployeeForm } from '../EmployeeFormContext';
import { Input } from '../../../components/ui/input';

export default function GeneralTab() {
  const { 
    form, 
    photoPreview, 
    signaturePreview, 
    photoInputRef, 
    signatureInputRef, 
    handlePhotoChange, 
    handleSignatureChange,
    isManualCodeAllowed,
    setIsBiometricManuallyEdited,
    employeeAge,
    isDifferentlyAbled,
    isCurrentManualEntry,
    setIsCurrentManualEntry,
    isCurrentPincodeVerified,
    setIsCurrentPincodeVerified,
    currentPincodeResults,
    setCurrentPincodeResults,
    isPermSameAsCurrent,
    isPermManualEntry,
    setIsPermManualEntry,
    isPermPincodeVerified,
    setIsPermPincodeVerified,
    permPincodeResults,
    setPermPincodeResults,
    currentMode,
    isSuperAdmin
  } = useEmployeeForm();

  const { register, formState: { errors }, watch, setValue } = form;

  return (
    <FormProvider {...form}>
${tabLines.map(line => '      ' + line).join('\n')}
    </FormProvider>
  );
}
`;

    fs.writeFileSync('src/pages/employee/components/GeneralTab.tsx', componentContent);
    console.log("GeneralTab.tsx created");
    
    // Modify EmployeeMaster
    const newOriginalLines = [
        ...lines.slice(0, startIndex),
        `                  <GeneralTab />`,
        ...lines.slice(endIndex)
    ];

    fs.writeFileSync('src/pages/employee/EmployeeMaster.tsx', newOriginalLines.join('\n'));
    console.log("EmployeeMaster.tsx updated");
} else {
    console.log("Could not find boundaries", startIndex, endIndex);
}
