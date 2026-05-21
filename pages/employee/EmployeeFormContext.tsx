import React, { createContext, useContext, ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { EmployeeData } from './types';

// We define the shape of our context, merging react-hook-form methods and local UI state.
interface EmployeeFormContextType {
  form: UseFormReturn<EmployeeData>;
  currentMode: string;
  isSuperAdmin: boolean;
  
  // UI States
  photoPreview: string | null;
  signaturePreview: string | null;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  signatureInputRef: React.RefObject<HTMLInputElement | null>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSignatureChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  // Code & Biometric
  isManualCodeAllowed: boolean;
  setIsBiometricManuallyEdited: (value: boolean) => void;
  employeeAge: number;
  isDifferentlyAbled: boolean;
  
  // Address & Pincodes
  isCurrentManualEntry: boolean;
  setIsCurrentManualEntry: (value: boolean) => void;
  isCurrentPincodeVerified: boolean;
  setIsCurrentPincodeVerified: (value: boolean) => void;
  currentPincodeResults: any[];
  setCurrentPincodeResults: (value: any[]) => void;
  isPermSameAsCurrent: boolean;
  isPermManualEntry: boolean;
  setIsPermManualEntry: (value: boolean) => void;
  isPermPincodeVerified: boolean;
  setIsPermPincodeVerified: (value: boolean) => void;
  permPincodeResults: any[];
  setPermPincodeResults: (value: any[]) => void;

  // Employment Tab
  employeeStatuses: any[];
  employmentTypes: any[];
  groups: any[];
  departments: any[];
  designations: any[];
  locations: any[];
  divisions: any[];
  categories: any[];
  classes: any[];
  shifts: any[];
  employees: any[];
  selectedGroupId: string | number;
  selectedLocationId: string | number;
  isRoot: boolean;
  gratuityEligibility: any;
  estimatedGratuity: any;
  isFteContractValue: boolean;

  // Wages Tab
  weeklyOffSource: string;
  selectedEmployeeId: string | null;
  workingDayTypes: any[];
  salarySlabs: any[];
  fetchRevisionHistory: (empId: number) => void;
  setIsRevisionHistoryOpen: (value: boolean) => void;
  isBifurcationExceeded: boolean;
  isShowingHistoricalRate: boolean;
  revisionData: any;
  setRevisionData: (data: any) => void;
  setIsRevisionRecordOpen: (value: boolean) => void;
  bifurcationData: any[];
  isBifurcationValid: boolean;
  gratuityLedger: any[];

  // Docs Tab
  handleFileDownload: (docType: string, path: string) => void;
  handleDuplicateCheck: (field: string, value: string, name?: string) => Promise<boolean>;
  isExitDateLocked: boolean;
  pfHistory: any[];
  addPfRecord: () => void;
  removePfRecord: (index: number) => void;
  esiHistory: any[];
  addEsiRecord: () => void;
  removeEsiRecord: (index: number) => void;
  bankHistory: any[];
  addBankDetail: () => void;
  removeBankDetail: (index: number) => void;
  isIfscSearching: boolean;
  handleIfscSearch: () => void;

  // History Tab
  employmentHistory: any[];
  setEmploymentHistory: (value: any[]) => void;
  addHistory: () => void;
  removeHistory: (index: number) => void;
}

const EmployeeFormContext = createContext<EmployeeFormContextType | undefined>(undefined);

export function EmployeeFormProvider({ children, value }: { children: ReactNode, value: EmployeeFormContextType }) {
  return (
    <EmployeeFormContext.Provider value={value}>
      {children}
    </EmployeeFormContext.Provider>
  );
}

export function useEmployeeForm() {
  const context = useContext(EmployeeFormContext);
  if (context === undefined) {
    throw new Error('useEmployeeForm must be used within an EmployeeFormProvider');
  }
  return context;
}
