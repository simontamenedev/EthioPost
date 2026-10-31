export type ImportStage = 0 | 1 | 2 | 3 | 4;

export type ReportStage = 0 | 1 | 2 | 3;

export type Agent = {
  code: string;
  name: string;
  branch: string;
  district: string;
  tx: number;
  amount: number;
};

export type DistrictSummary = {
  name: string;
  agents: number;
  tx: number;
  amount: number;
};

export type AnimationPosition = {
  x: number;
  y: number;
};

export type AnimatedNumberProps = {
  value: number;
};

export type NumProps = {
  value: number;
  delay?: number;
  duration?: number;
};

export type ExcelWindowProps = {
  stage: ImportStage;
  count: number;
};