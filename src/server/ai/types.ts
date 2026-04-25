export type KnowledgeFragment = {
  id: string;
  content: string;
};

export type OrganizationResult = {
  title: string;
  outline: string[];
  followUpQuestions: string[];
};

export type AIProvider = {
  generate(input: {
    fragments: KnowledgeFragment[];
    systemPrompt: string;
  }): Promise<OrganizationResult>;
};
