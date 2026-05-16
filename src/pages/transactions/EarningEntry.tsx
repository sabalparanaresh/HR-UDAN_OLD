import React from 'react';
import VariableSalaryEntry from './VariableSalaryEntry';

export default function EarningEntry({ currentUser }: { currentUser: any }) {
  return <VariableSalaryEntry type="EARNING" currentUser={currentUser} />;
}
