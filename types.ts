export enum ResultType {
  Text = 'text',
  BoundingBox = 'bbox',
  Score = 'score',
  Number = 'number',
  YesNo = 'yes/no',
  Category = 'category',
  JSON = 'json',
}

export interface Prompt {
  id: string;
  text: string;
  type: ResultType;
  scoreRange?: [number, number];
  categories?: string[];
  jsonSchema?: string;
  parentId?: string;
  condition?: 'yes' | 'no'; // For Yes/No parents
  scoreConditionOperator?: 'above' | 'below'; // For Score parents
  scoreConditionValue?: number; // For Score parents
  regionType?: 'point' | 'bbox';
  regionCoords?: [number, number] | [number, number, number, number];
}

export interface BoundingBox {
  box: [number, number, number, number]; // [x1, y1, x2, y2] relative to 1000x1000 canvas
  label: string;
}

export interface BboxChildResult {
  parentBox: BoundingBox;
  resultData: string | number | null;
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AnalysisResult {
  promptId: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  data: string | BoundingBox[] | number | BboxChildResult[] | any | null;
  error?: string;
  conversationHistory?: { question: string, answer: string }[];
  requestPayload?: any;
  rawResponse?: any;
}