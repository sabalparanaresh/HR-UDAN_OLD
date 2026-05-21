import React from 'react';
import VariableSalaryEntry from './VariableSalaryEntry';

export default function DeductionEntry({ currentUser }: { currentUser: any }) {
  return <VariableSalaryEntry type="DEDUCTION" currentUser={currentUser} />;
}
