export interface User {
  id: number;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface MedicineBasic {
  medicine_id: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  strength?: string;
  dosage_form?: string;
  price_inr?: number;
  ingredient_1?: string;
  ingredient_2?: string;
  ingredient_3?: string;
  brand_match?: boolean;
  ingredient_match?: boolean;
  both_agree?: boolean;
  is_mismatch?: boolean;
  mismatch_reason?: string;
  auto_selected?: boolean;
}

export interface ExtractedEntities {
  raw_text: string;
  detected_brand?: string;
  detected_ingredients?: string[];
  candidate_brands?: string[];
  primary_strength?: string;
  dosage_form?: string;
  batch_number?: string;
  barcode?: string;
  barcode_type?: string;
  confidence_level?: 'high' | 'medium' | 'weak';
  is_clear_read?: boolean;
  clarity_message?: string;
  matched_candidates?: MedicineBasic[];
  best_candidate?: MedicineBasic | null;
}

export interface ScanImageResponse {
  success: boolean;
  barcode_detected: boolean;
  barcode_info?: any;
  extracted_entities: ExtractedEntities;
}

export interface IngredientItem {
  raw_name: string;
  normalized_name: string;
  strength: string;
  has_restriction: boolean;
  status_text: string;
  matching_record?: {
    ban_id: string;
    ban_category: string;
    drug_name: string;
    reason: string;
    notification_number: string;
    notification_date: string;
    regulatory_authority: string;
    source_url: string;
  };
}

export interface EvidenceRecord {
  type: string;
  title: string;
  reason?: string;
  notification_number?: string;
  notification_date?: string;
  regulatory_authority?: string;
  source_url?: string;
}

export interface ClinicalInformation {
  what_it_is_used_for: string;
  approved_uses: string[];
  precautions: string[];
  side_effects: string[];
  reliable_reference: string;
  has_verified_clinical_info: boolean;
}

export interface RegulatoryResult {
  verdict_status: 'prohibited_fdc' | 'banned' | 'restricted' | 'no_ban_found' | 'unable_to_determine' | 'unconfirmed';
  verdict_label: string;
  verdict_severity: 'danger' | 'warning' | 'neutral' | 'info';
  verdict_description: string;
  product_details: {
    medicine_id: string;
    medicine_name: string;
    brand_name?: string;
    generic_name?: string;
    active_ingredients?: string[];
    manufacturer?: string;
    strength?: string;
    dosage_form?: string;
    therapeutic_category?: string;
    price_inr?: number;
    pack_size?: string;
    is_discontinued?: boolean;
  };
  clinical_information?: ClinicalInformation;
  ingredient_analysis: IngredientItem[];
  fdc_analysis: {
    is_combination: boolean;
    ingredient_count: number;
    prohibited_matches: any[];
    historical_matches: any[];
  };
  evidence_records: EvidenceRecord[];
  data_freshness_disclaimer: string;
}

export interface ScanHistoryItem {
  id: number;
  medicine_id: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  input_method: string;
  verdict_status: string;
  verdict_label: string;
  raw_input?: string;
  created_at: string;
}

export interface SavedMedicineItem {
  id: number;
  medicine_id: string;
  medicine_name: string;
  generic_name?: string;
  manufacturer?: string;
  verdict_status: string;
  verdict_label: string;
  notes?: string;
  saved_at: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city?: string;
  pin_code?: string;
  phone?: string;
  opening_hours?: string;
  latitude: number;
  longitude: number;
  source?: string;
  type?: string;
  distance_km?: number;
  license_verified?: boolean;
}

export interface ShopFeedback {
  id: number;
  shop_name: string;
  shop_address?: string;
  city?: string;
  pin_code?: string;
  rating: number;
  comments?: string;
  created_at: string;
  user_email?: string;
}
