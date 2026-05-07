export type SubjectTag = 'Coding' | 'Design' | 'Writing' | 'Reading' | 'Maths' | 'Other';

export type TagConfig = {
  label: string;
  emoji: string;
};

export const TAG_CONFIG: Record<SubjectTag, TagConfig> = {
  Coding:  { label: 'Coding',  emoji: '💻' },
  Design:  { label: 'Design',  emoji: '✏️' },
  Writing: { label: 'Writing', emoji: '🖊️' },
  Reading: { label: 'Reading', emoji: '📖' },
  Maths:   { label: 'Maths',   emoji: '📐' },
  Other:   { label: 'Other',   emoji: '🕯️' },
};

export const TAG_LIST: SubjectTag[] = ['Coding', 'Design', 'Writing', 'Reading', 'Maths', 'Other'];
export const DEFAULT_TAG: SubjectTag = 'Coding';
