export type KnowledgeFragment = {
  id: string;
  content: string;
};

export type OrganizationResult = {
  title: string;
  outline: string[];
  followUpQuestions: string[];
};

export type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

export type TrainingContent = {
  title: string;
  framework: string;
  totalMinutes: number;
  slides: Slide[];
};

export type OrganizationInput = {
  fragments: KnowledgeFragment[];
  systemPrompt: string;
};

export type SlideGenerationInput = {
  fragments: KnowledgeFragment[];
  framework: {
    id: string;
    name: string;
    structure: string[];
  };
  topic?: string;
  instruction?: string;
  previousSlides?: TrainingContent;
};

export type AIProvider = {
  generate(input: OrganizationInput): Promise<OrganizationResult>;
  generateSlides(input: SlideGenerationInput): Promise<TrainingContent>;
};
