import { ReportResolver } from '../../../../types';
import { resolveAadharConsent } from './query';

export const AadharConsentResolver: ReportResolver = {
  resolve: resolveAadharConsent
};

export default AadharConsentResolver;
