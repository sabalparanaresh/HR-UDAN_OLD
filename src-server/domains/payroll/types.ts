export interface PayrollCalculationInput {
  employeeId: string;
  month: number;
  year: number;
}

export interface PayrollDraft {
  gross: number;
  net: number;
  deductions: number;
  breakdown: Record<string, number>;
}
