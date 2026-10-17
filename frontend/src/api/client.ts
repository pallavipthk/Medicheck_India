import { RegulatoryResult, MedicineBasic, ScanHistoryItem, SavedMedicineItem, Pharmacy, ShopFeedback, AuthResponse, User } from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('medicheck_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiSearchMedicines(query: string, limit = 15): Promise<MedicineBasic[]> {
  const res = await fetch(`${API_BASE}/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.results || [];
}

export async function apiGetMedicineDetails(medicineId: string): Promise<RegulatoryResult> {
  const res = await fetch(`${API_BASE}/medicines/${encodeURIComponent(medicineId)}`);
  if (!res.ok) throw new Error('Medicine not found');
  return await res.json();
}

export async function apiEvaluateCustom(params: {
  medicine_name: string;
  ingredients: string[];
  dosage_form?: string;
  strength?: string;
  manufacturer?: string;
}): Promise<RegulatoryResult> {
  const res = await fetch(`${API_BASE}/medicines/evaluate-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Evaluation failed');
  return await res.json();
}

export async function apiScanImage(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/scan/image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Image scan failed');
  return await res.json();
}

export async function apiMatchCatalog(params: {
  brand?: string;
  ingredients?: string[];
}): Promise<{
  candidates: MedicineBasic[];
  best_candidate: MedicineBasic | null;
}> {
  const res = await fetch(`${API_BASE}/scan/match-catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Catalog match failed');
  return await res.json();
}

export async function apiConfirmScan(params: {
  medicine_id?: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  input_method: string;
  custom_ingredients?: string[];
  raw_input?: string;
}): Promise<RegulatoryResult> {
  const res = await fetch(`${API_BASE}/scan/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Confirmation failed');
  return await res.json();
}

export async function apiGetHistory(): Promise<ScanHistoryItem[]> {
  const res = await fetch(`${API_BASE}/history`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error('Failed to load history');
  return await res.json();
}

export async function apiDeleteHistory(id: number): Promise<void> {
  await fetch(`${API_BASE}/history/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
}

export async function apiGetSaved(): Promise<SavedMedicineItem[]> {
  const res = await fetch(`${API_BASE}/saved`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error('Failed to load saved medicines');
  return await res.json();
}

export async function apiSaveMedicine(params: {
  medicine_id: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  verdict_status: string;
  verdict_label: string;
  notes?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/saved`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to save medicine');
}

export async function apiRemoveSaved(medicineId: string): Promise<void> {
  await fetch(`${API_BASE}/saved/${encodeURIComponent(medicineId)}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
}

export async function apiAskAssistant(params: {
  query: string;
  medicine_id?: string;
  medicine_name?: string;
}): Promise<{ response: string; source: string; provider: string; is_configured: boolean; configuration_notice?: string }> {
  const res = await fetch(`${API_BASE}/assistant/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('AI query failed');
  return await res.json();
}

export async function apiGetPharmacies(params: { q?: string; lat?: number; lon?: number }): Promise<{
  success: boolean;
  message: string;
  pharmacies: Pharmacy[];
  provider: string;
  center?: { lat: number; lon: number; name: string };
}> {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.lat != null) query.append('lat', params.lat.toString());
  if (params.lon != null) query.append('lon', params.lon.toString());

  const res = await fetch(`${API_BASE}/locator/pharmacies?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to locate pharmacies');
  return await res.json();
}

export async function apiGetShopFeedback(shopName?: string): Promise<ShopFeedback[]> {
  const query = shopName ? `?shop_name=${encodeURIComponent(shopName)}` : '';
  const res = await fetch(`${API_BASE}/locator/feedback${query}`);
  if (!res.ok) return [];
  return await res.json();
}

export async function apiSubmitShopFeedback(params: {
  shop_name: string;
  shop_address?: string;
  city?: string;
  pin_code?: string;
  rating: number;
  comments?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/locator/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to submit shop review');
}

export function getPdfDownloadUrl(medicineId: string): string {
  return `${API_BASE}/reports/pdf/${encodeURIComponent(medicineId)}`;
}

export async function apiDownloadPdfReport(medicineId: string, evaluation?: RegulatoryResult): Promise<void> {
  let res: Response;
  if (medicineId === 'CUSTOM_ENTRY' && evaluation) {
    res = await fetch(`${API_BASE}/reports/pdf/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evaluation),
    });
  } else {
    const params = new URLSearchParams();
    if (evaluation?.product_details?.medicine_name) {
      params.append('name', evaluation.product_details.medicine_name);
    }
    if (evaluation?.product_details?.generic_name) {
      params.append('generic', evaluation.product_details.generic_name);
    }
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    res = await fetch(`${API_BASE}/reports/pdf/${encodeURIComponent(medicineId)}${queryStr}`);
  }

  if (!res.ok) {
    throw new Error('Could not download PDF report from verification server.');
  }

  const blob = await res.blob();
  const medName = evaluation?.product_details?.medicine_name || medicineId;
  const cleanName = medName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `MediCheck_${cleanName}_Report.pdf`;

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}
