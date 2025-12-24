export type PollSummary = {
  id: number;
  name: string;
  optionCount: number;
  startTime: number;
  endTime: number;
  creator: string;
  finalized: boolean;
  published: boolean;
};

export type DecryptedResult = {
  counts: number[];
  proof: `0x${string}`;
};
