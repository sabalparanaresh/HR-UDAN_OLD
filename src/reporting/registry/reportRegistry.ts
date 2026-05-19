import { ReportDefinition } from '../types';

const registry = new Map<string, ReportDefinition>();

export function registerReport(definition: ReportDefinition) {
  registry.set(definition.reportKey, definition);
}

export function getReportDefinition(reportKey: string): ReportDefinition | undefined {
  return registry.get(reportKey);
}

export function getAllReports(): ReportDefinition[] {
  return Array.from(registry.values());
}

export function getReportsByDataSource(dataSource: string): ReportDefinition[] {
  return Array.from(registry.values()).filter(r => r.dataSource === dataSource);
}

export function getReportsByGroup(group: string): ReportDefinition[] {
  return Array.from(registry.values()).filter(r => r.group === group);
}
