export type Role = 'ADMIN' | 'USER';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type ListingPosition = {
  id: string;
  sequenceNo: number;
  title: string;
  serviceClass?: string | null;
  grade?: number | null;
  quota?: number | null;
  educationRequirement?: string | null;
  gender?: string | null;
  kpssScoreType?: string | null;
  kpssMinScore?: string | number | null;
};

export type MyTracking = {
  id: string;
  status: string;
  applyChannel?: string | null;
  mailOk?: boolean;
  formOk?: boolean;
  updatedFlag?: boolean;
};

export type Listing = {
  id: string;
  title: string;
  position?: string | null;
  city?: string | null;
  kind: 'PUBLIC' | 'PRIVATE';
  source: string;
  status: string;
  url?: string | null;
  applyStartAt?: string | null;
  applyEndAt?: string | null;
  examAt?: string | null;
  resultAnnounceAt?: string | null;
  publishedAt?: string | null;
  kpssScoreType?: string | null;
  kpssMinScore?: string | number | null;
  applicationMethods?: string[];
  requiredDocuments?: string[];
  generalRequirements?: string | null;
  specialRequirements?: string | null;
  examTopics?: string | null;
  institution?: { id: string; name: string } | null;
  positions?: ListingPosition[];
  possibleDup?: boolean;
  myTracking?: MyTracking | null;
};

export type Profile = {
  education?: string | null;
  preferredCity?: string | null;
  kpssScores: Record<string, number>;
  certificates: string[];
  skills: string[];
  targetTitles: string[];
  emailAlerts: boolean;
};

export type PipelineRow = {
  id: string;
  status: string;
  notes?: string | null;
  matchScore?: number | null;
  updatedFlag?: boolean;
  applyChannel?: string | null;
  mailOk?: boolean;
  formOk?: boolean;
  listing: Listing;
  position?: ListingPosition | null;
};
