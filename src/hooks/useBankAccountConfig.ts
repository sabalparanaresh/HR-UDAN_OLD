import { useState, useEffect } from 'react';
import { invokeCommand as invoke, fetchApi } from '../services/apiClient';
import { useModule } from '../contexts/ModuleContext';

export interface BankAccountConfig {
  bank?: string;
  account_no?: string;
  ifsc_code?: string;
  cms_client_code?: string;
  cms_product_code?: string;
  reference_start_no?: string;
  payment_type_identifier_same_bank?: string;
  payment_type_identifier_other_bank?: string;
}

export function useBankAccountConfig(bankName?: string) {
  const { currentMode } = useModule();
  const [configs, setConfigs] = useState<BankAccountConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchConfig = async () => {
      try {
        const configData = await fetchApi<any>('/api/config/company', { headers: { 'x-module-type': currentMode } });
        if (active && configData && configData.bank_accounts) {
          setConfigs(configData.bank_accounts);
        }
      } catch (err) {
        console.error("Failed to load bank setup:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchConfig();
    return () => { active = false; };
  }, [currentMode]);

  const selectedBankConfig = bankName ? configs.find(c => c.bank === bankName) : null;

  return {
    configs,
    selectedBankConfig,
    loading
  };
}
