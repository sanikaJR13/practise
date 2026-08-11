import { apiClient } from '@/lib/api/api-client';
import { normalizeSourceRun } from '@/lib/api/adapters';

export const recordsService = {
  async getIgrHistory(propertyId) {
    const response = await apiClient.get(`source-runs/${propertyId}/`);
    return normalizeSourceRun(response);
  }
};
