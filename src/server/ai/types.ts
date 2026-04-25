export type KnowledgeFragment = {
  id: string;
  content: string;
};

export type OrganizationResult = {
  title: string;
  outline: string[];
  followUpQuestions: string[];
};

export type OrganizationInput = {
  fragments: KnowledgeFragment[];
  systemPrompt: string;
};

export type AIProvider = {
  generate(input: OrganizationInput): Promise<OrganizationResult>;
};
